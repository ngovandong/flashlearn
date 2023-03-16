from urllib.parse import urlencode

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from django.conf import settings
from django.urls import reverse
from django.shortcuts import redirect

from ..serializers import CustomTokenObtainPairSerializer, AcctiveAccountSerializer, UserSerializer, \
    SetPasswordSerializer, \
    GoogleCallbackSerializer, GoogleUserSerializer, ChangePasswordSerializer
from ..models import User
from base.views import FlexibleViewSet

from ..services import AuthService, UserService, MailService

login_url = f'{settings.BASE_FRONTEND_URL}/login'


class UserViewSet(viewsets.ReadOnlyModelViewSet, FlexibleViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    permission_classes = ()

    serializer_map = {
        'login': CustomTokenObtainPairSerializer,
        'refresh': TokenRefreshSerializer,
        'change_password': SetPasswordSerializer,
        'google_login': GoogleCallbackSerializer,
        'init': GoogleUserSerializer,
        'active_account': AcctiveAccountSerializer
    }

    permission_map = {'change_password': [permissions.IsAuthenticated]}

    @action(detail=False, methods=['POST'])
    def login(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])
        return Response(serializer.validated_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['POST'])
    def refresh(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        return Response(serializer.validated_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['POST'])
    def sign_up(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        domain = settings.BASE_BACKEND_URL
        api_url = reverse('user-active-account')
        active_account_url = f'{domain}{api_url}'

        token = AuthService.get_verify_email_token(user)

        params = urlencode({'token': token})
        link = f'{active_account_url}?{params}'

        context = {'name': user.name, 'link': link}

        MailService.send_template_mail(
            user.email, 'emails/confirm_email.html', context)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        user = self.get_object()
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            # Check old password
            if not user.check_password(serializer.data.get("old_password")):
                return Response({"old_password": ["Wrong password."]}, status=status.HTTP_400_BAD_REQUEST)
            # Set new password
            user.set_password(serializer.data.get("new_password"))
            user.save()
            return Response({"status": "password changed"}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'])
    def google_login(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.GET)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        code = validated_data.get('code')
        error = validated_data.get('error')

        if error or not code:
            params = urlencode({'error': error})
            return redirect(f'{login_url}?{params}')

        domain = settings.BASE_BACKEND_URL
        api_uri = reverse('user-google-login')
        redirect_uri = f'{domain}{api_uri}'

        access_token = AuthService.google_get_access_token(
            code=code, redirect_uri=redirect_uri)

        user_data = AuthService.google_get_user_info(access_token=access_token)

        profile_data = {
            'email': user_data['email'],
            'first_name': user_data.get('given_name', ''),
            'last_name': user_data.get('family_name', ''),
            'name': user_data.get('name', ''),
            'image_url': user_data.get('picture', ''),
        }

        # We use get-or-create logic here for the sake of the example.
        # We don't have a sign-up flow.
        user, _ = UserService.user_get_or_create_validated_email_user(
            **profile_data)

        if not user.is_google_account:
            params = urlencode(
                {'error': "It looks like you already have an account with that email"})
            return redirect(f'{login_url}?{params}')

        token = AuthService.get_token(user)

        params = urlencode(token)
        return redirect(f'{login_url}?{params}')
    
    @action(detail=False, methods=['GET'])
    def init(self, request, *args, **kwargs):
        id_token = request.headers.get('Authorization')

        if not id_token:
            return Response({'error': 'token is require'},
                            status=status.HTTP_400_BAD_REQUEST)

        user_data = AuthService.google_validate_id_token(id_token)

        profile_data = {
            'email': user_data['email'],
            'first_name': user_data.get('given_name', ''),
            'last_name': user_data.get('family_name', ''),
            'name': user_data.get('name', ''),
            'image_url': user_data.get('picture', ''),
        }

        user, _ = UserService.user_get_or_create_validated_email_user(**profile_data)

        if not user.is_google_account:
            return Response({'error': 'It looks like you already have an account with that email'},
                            status=status.HTTP_400_BAD_REQUEST)

        token = AuthService.get_token(user)
        return Response(token)

    @action(detail=False, methods=['GET'])
    def active_account(self, request, *args, **kwargs):
        token = request.GET['token']
        data = {'refresh': token}
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        user_id = serializer.user_id
        UserService.active_user(user_id)

        params = urlencode(serializer.validated_data)
        return redirect(f'{login_url}?{params}')
