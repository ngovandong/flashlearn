import base64
import json
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from backend.shared.application.exceptions import ValidationError as DomainValidationError
from backend.shared.interfaces.viewsets import FlexibleViewSet

from ..models import User
from ..serializers import (
    ActiveAccountSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    GoogleCallbackSerializer,
    GoogleUserSerializer,
    LearningStreakSerializer,
    SetPasswordSerializer,
    UserSerializer,
)
from ..services import auth_service, learning_service, user_service
from ..tasks import setup_new_user
from ..utils.dispatch import dispatch

login_url = f"{settings.BASE_FRONTEND_URL}/login"


def set_refresh_cookie(response, refresh_token: str) -> None:
    """Store the refresh token in an HttpOnly cookie so JS (incl. XSS) can't read
    it. The access token is the only credential the frontend holds in memory."""
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response) -> None:
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def session_payload(user):
    """One token pair for a fresh session. Returns (refresh_token, body) where
    body = {access, user} for the response and the refresh goes in the cookie."""
    token: dict[str, Any] = auth_service.get_token(user)
    body = {"access": token["access"], "user": UserSerializer(user).data}
    return token["refresh"], body


def token_fragment_params(user):
    """URL fragment params for the OAuth redirect — access + user only. The
    refresh token never goes in the URL; it's set as an HttpOnly cookie."""
    token = auth_service.get_token(user)
    user_data = UserSerializer(user).data
    return token["refresh"], {
        "access": token["access"],
        "user": base64.urlsafe_b64encode(json.dumps(user_data).encode()).decode(),
    }


class UserViewSet(viewsets.ReadOnlyModelViewSet, FlexibleViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    permission_classes = ()

    serializer_map = {
        "login": CustomTokenObtainPairSerializer,
        "refresh": TokenRefreshSerializer,
        "change_password": SetPasswordSerializer,
        "google_login": GoogleCallbackSerializer,
        "init": GoogleUserSerializer,
        "active_account": ActiveAccountSerializer,
    }

    permission_map = {
        "change_password": [permissions.IsAuthenticated],
        "get_profile": [permissions.IsAuthenticated],
        "learning_streak": [permissions.IsAuthenticated],
        "record_study": [permissions.IsAuthenticated],
        "my_settings": [permissions.IsAuthenticated],
        "extension_token": [permissions.IsAuthenticated],
        # Logout acts only on the presented refresh cookie, so it must work even
        # when the short-lived access token has already expired.
        "logout": [permissions.AllowAny],
    }

    @action(detail=False, methods=["POST"])
    def extension_token(self, request, *args, **kwargs):
        """Mint a fresh token pair for the browser extension.

        The SPA keeps its refresh token in an HttpOnly cookie it can't read, so
        when an already-logged-in user connects the extension there's no token to
        relay. This authenticated endpoint returns a {access, refresh, user} pair
        the SPA can hand off to the extension (which uses the Bearer + body-refresh
        flow). Gated by IsAuthenticated — same trust level as logging in."""
        token: dict[str, Any] = auth_service.get_token(request.user)
        return Response(
            {
                "access": token["access"],
                "refresh": token["refresh"],
                "user": UserSerializer(request.user).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["GET"])
    def get_profile(self, request, *args, **kwargs):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def learning_streak(self, request, *args, **kwargs):
        data = learning_service.get_learning_streak(request.user)
        return Response(LearningStreakSerializer(data).data)

    @action(detail=False, methods=["POST"])
    def record_study(self, request, *args, **kwargs):
        learning_service.record_study_activity(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["GET", "PATCH"])
    def my_settings(self, request, *args, **kwargs):
        if request.method == "GET":
            return Response(user_service.get_settings(request.user))
        return Response(user_service.update_settings(request.user, request.data))

    @action(detail=False, methods=["POST"])
    def login(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e
        data = dict(serializer.validated_data)
        refresh = data.pop("refresh")
        # The refresh token is also returned in the body so the SPA can relay it to
        # the browser extension (which keeps its own Bearer + refresh flow). The SPA
        # itself ignores the body refresh and relies on the HttpOnly cookie below.
        response = Response(
            {"access": data["access"], "user": data.get("user"), "refresh": refresh},
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, refresh)
        return response

    @action(detail=False, methods=["POST"])
    def logout(self, request, *args, **kwargs):
        # SPA presents the refresh token via the HttpOnly cookie; the extension
        # sends it in the body. Accept either so both can revoke their token.
        refresh = request.data.get("refresh") or request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if refresh:
            auth_service.blacklist_refresh_token(refresh)
        response = Response(status=status.HTTP_205_RESET_CONTENT)
        clear_refresh_cookie(response)
        return response

    @action(detail=False, methods=["POST"])
    def refresh(self, request, *args, **kwargs):
        # Two clients refresh here: the SPA (token in the HttpOnly cookie) and the
        # browser extension (token in the request body). The extension can't read
        # the cookie cross-origin, so we accept either channel.
        body_refresh = request.data.get("refresh")
        refresh = body_refresh or request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh:
            return Response({"errors": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e
        data = dict(serializer.validated_data)
        new_refresh = data.pop("refresh", None)
        payload = {"access": data["access"]}
        response = Response(payload, status=status.HTTP_200_OK)
        if new_refresh:
            # Respond on the same channel the client used: echo the rotated refresh
            # in the body for the extension, or reset the cookie for the SPA.
            if body_refresh:
                payload["refresh"] = new_refresh
            else:
                set_refresh_cookie(response, new_refresh)
        return response

    @action(detail=False, methods=["POST"])
    def sign_up(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        domain = settings.BASE_BACKEND_URL
        api_url = reverse("user-active-account")
        active_account_url = f"{domain}{api_url}"
        token = auth_service.get_verify_email_token(user)
        params = urlencode({"token": token})
        link = f"{active_account_url}?{params}"

        dispatch(setup_new_user, user.id, link)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def change_password(self, request, pk=None):
        user = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user_service.change_password(
                    user,
                    serializer.validated_data.get("old_password"),
                    serializer.validated_data.get("new_password"),
                )
            except DomainValidationError:
                return Response({"old_password": ["Wrong password."]}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"status": "password changed"}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["GET"])
    def google_login(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.GET)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        code = validated_data.get("code")
        error = validated_data.get("error")

        if error or not code:
            params = urlencode({"error": error})
            return redirect(f"{login_url}?{params}")

        state = validated_data.get("state") or request.GET.get("state")
        redirect_uri = None
        if state:
            import base64
            import json

            try:
                padded_state = state + "=" * (-len(state) % 4)
                decoded_state = json.loads(base64.b64decode(padded_state).decode("utf-8"))
                redirect_uri = decoded_state.get("r")
            except Exception:
                pass

        if not redirect_uri:
            domain = settings.BASE_BACKEND_URL
            api_uri = reverse("user-google-login")
            redirect_uri = f"{domain}{api_uri}"

        access_token = auth_service.google_get_access_token(code=code, redirect_uri=redirect_uri)
        user_data = auth_service.google_get_user_info(access_token=access_token)
        profile_data = auth_service.google_profile_from_user_data(user_data)
        user, _ = user_service.user_get_or_create_validated_email_user(**profile_data)

        if not user.is_google_account:
            params = urlencode(
                {"error": "You already have an account with that email. Please log in with your password."}
            )
            return redirect(f"{login_url}?{params}")

        # Access token + user go in the URL fragment (#) — never the query string
        # — so they aren't logged or leaked via Referer. The refresh token is set
        # as an HttpOnly cookie on this redirect response instead of in the URL.
        refresh, params = token_fragment_params(user)
        response = redirect(f"{login_url}#{urlencode(params)}")
        set_refresh_cookie(response, refresh)
        return response

    @action(detail=False, methods=["GET"])
    def init(self, request, *args, **kwargs):
        id_token = request.headers.get("Authorization")
        if not id_token:
            return Response({"error": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_data = auth_service.google_validate_id_token(id_token)
        profile_data = auth_service.google_profile_from_user_data(user_data)
        user, _ = user_service.user_get_or_create_validated_email_user(**profile_data)

        if not user.is_google_account:
            return Response(
                {"error": "You already have an account with that email. Please log in with your password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh, body = session_payload(user)
        # Include refresh in the body so the SPA can relay it to the extension
        # (see login). The SPA stores only the access token from this response.
        body["refresh"] = refresh
        response = Response(body)
        set_refresh_cookie(response, refresh)
        return response

    @action(detail=False, methods=["GET"])
    def active_account(self, request, *args, **kwargs):
        token = request.GET["token"]
        data = {"refresh": token}
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e

        user_id = serializer.user_id
        user_service.active_user(user_id)

        # Access + user in the fragment; refresh token in the HttpOnly cookie.
        validated = serializer.validated_data
        user_param = base64.urlsafe_b64encode(json.dumps(validated["user"]).encode()).decode()
        params = urlencode({"access": validated["access"], "user": user_param})
        response = redirect(f"{login_url}#{params}")
        set_refresh_cookie(response, validated["refresh"])
        return response
