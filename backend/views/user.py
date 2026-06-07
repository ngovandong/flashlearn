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
from ..services import AuthService, LearningService, UserService
from ..tasks import setup_new_user
from ..utils.dispatch import dispatch

login_url = f"{settings.BASE_FRONTEND_URL}/login"


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
    }

    @action(detail=False, methods=["GET"])
    def get_profile(self, request, *args, **kwargs):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["GET"])
    def learning_streak(self, request, *args, **kwargs):
        user = User.objects.get(pk=request.user.pk)
        data = LearningService.get_learning_streak(user)
        return Response(LearningStreakSerializer(data).data)

    @action(detail=False, methods=["POST"])
    def record_study(self, request, *args, **kwargs):
        LearningService.record_study_activity(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["GET", "PATCH"])
    def my_settings(self, request, *args, **kwargs):
        if request.method == "GET":
            return Response(UserService.get_settings(request.user))
        return Response(UserService.update_settings(request.user, request.data))

    @action(detail=False, methods=["POST"])
    def login(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e
        return Response(serializer.validated_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["POST"])
    def refresh(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0]) from e
        return Response(serializer.validated_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["POST"])
    def sign_up(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        domain = settings.BASE_BACKEND_URL
        api_url = reverse("user-active-account")
        active_account_url = f"{domain}{api_url}"
        token = AuthService.get_verify_email_token(user)
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
                UserService.change_password(
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

        access_token = AuthService.google_get_access_token(code=code, redirect_uri=redirect_uri)
        user_data = AuthService.google_get_user_info(access_token=access_token)
        profile_data = AuthService.google_profile_from_user_data(user_data)
        user, _ = UserService.user_get_or_create_validated_email_user(**profile_data)

        if not user.is_google_account:
            params = urlencode({"error": "It looks like you already have an account with that email"})
            return redirect(f"{login_url}?{params}")

        token = AuthService.get_token(user)
        params = urlencode(token)
        return redirect(f"{login_url}?{params}")

    @action(detail=False, methods=["GET"])
    def init(self, request, *args, **kwargs):
        id_token = request.headers.get("Authorization")
        if not id_token:
            return Response({"error": "token is require"}, status=status.HTTP_400_BAD_REQUEST)

        user_data = AuthService.google_validate_id_token(id_token)
        profile_data = AuthService.google_profile_from_user_data(user_data)
        user, _ = UserService.user_get_or_create_validated_email_user(**profile_data)

        if not user.is_google_account:
            return Response(
                {"error": "It looks like you already have an account with that email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = AuthService.get_token(user)
        return Response(token)

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
        UserService.active_user(user_id)

        params = urlencode(serializer.validated_data)
        return redirect(f"{login_url}?{params}")
