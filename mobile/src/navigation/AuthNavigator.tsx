import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Auth stack per docs/03-sitemap-userflow.md §1: Login <-> Register / Forgot Password. */
export function AuthNavigator() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: t('nav.login') }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: t('nav.register') }} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: t('nav.forgotPassword') }}
      />
    </Stack.Navigator>
  );
}
