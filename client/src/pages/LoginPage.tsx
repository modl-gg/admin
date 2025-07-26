import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Input } from '@modl-gg/shared-web/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Alert, AlertDescription } from '@modl-gg/shared-web/components/ui/alert';
import { Mail, Lock, AlertCircle } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const codeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const { 
    requestCode, 
    isRequestingCode, 
    requestCodeError,
    login, 
    isLoggingIn, 
    loginError 
  } = useAuth();

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const onSubmitEmail = (data: EmailForm) => {
    setEmail(data.email);
    requestCode(data.email, {
      onSuccess: () => {
        setStep('code');
      }
    });
  };

  const onSubmitCode = (data: CodeForm) => {
    login({ email, code: data.code });
  };

  const goBack = () => {
    setStep('email');
    setEmail('');
    emailForm.reset();
    codeForm.reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">modl Admin</CardTitle>
          <CardDescription>
            {step === 'email' 
              ? 'Enter your admin email to receive a verification code'
              : 'Enter the 6-digit code sent to your email'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Error Display */}
          {(requestCodeError || loginError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(requestCodeError as any)?.message || (loginError as any)?.message || 'An error occurred'}
              </AlertDescription>
            </Alert>
          )}

          {step === 'email' ? (
            <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@modl.gg"
                    className="pl-10"
                    {...emailForm.register('email')}
                  />
                </div>
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isRequestingCode}
              >
                {isRequestingCode ? 'Sending Code...' : 'Send Verification Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={codeForm.handleSubmit(onSubmitCode)} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-2">
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                  {...codeForm.register('code')}
                />
                {codeForm.formState.errors.code && (
                  <p className="text-sm text-destructive mt-1">
                    {codeForm.formState.errors.code.message}
                  </p>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground text-center">
                Code sent to: <span className="font-medium">{email}</span>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={goBack}
                  disabled={isLoggingIn}
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Verifying...' : 'Login'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 