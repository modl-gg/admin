import { useState, useEffect } from 'react';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Textarea } from '@modl-gg/shared-web/components/ui/textarea';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@modl-gg/shared-web/components/ui/alert-dialog';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import { RefreshCw, RotateCcw, Save, Brain } from 'lucide-react';
import { systemService, type SystemPrompt } from '@/lib/services/system-service';
import { useSingleFlight } from '@/hooks/useSingleFlight';

export default function SystemPromptsPage() {
  const [prompt, setPrompt] = useState<SystemPrompt | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    try {
      setLoading(true);
      const loadedPrompt = await systemService.getSystemPrompt();
      setPrompt(loadedPrompt);
      setEditedPrompt(loadedPrompt?.prompt ?? '');
    } catch (caught) {
      console.error('Error loading prompt:', caught);
      toast({
        title: 'Error',
        description: 'Failed to load system prompt',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = useSingleFlight(async () => {
    if (!editedPrompt.trim()) {
      toast({
        title: 'Error',
        description: 'Prompt cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const updated = await systemService.updateSystemPrompt(editedPrompt);
      setPrompt(updated);
      setEditedPrompt(updated.prompt);
      toast({
        title: 'Success',
        description: 'System prompt updated',
      });
    } catch (caught) {
      console.error('Error saving prompt:', caught);
      toast({
        title: 'Error',
        description: 'Failed to save prompt',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  });

  const resetPrompt = useSingleFlight(async () => {
    try {
      setResetting(true);
      const reset = await systemService.resetSystemPrompt();
      setPrompt(reset);
      setEditedPrompt(reset.prompt);
      toast({
        title: 'Success',
        description: 'System prompt reset to default',
      });
    } catch (caught) {
      console.error('Error resetting prompt:', caught);
      toast({
        title: 'Error',
        description: 'Failed to reset prompt',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  });

  const hasUnsavedChanges = (prompt?.prompt ?? '') !== editedPrompt;
  const isLoadingState = saving || resetting;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading system prompt...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI System Prompt</h1>
          <p className="text-muted-foreground mt-1">Configure the AI moderation prompt</p>
        </div>
        <Card className="relative">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4" />
                <div>
                  <CardTitle className="text-xl">Moderation Prompt</CardTitle>
                  <CardDescription>Instructions used by the AI moderation system</CardDescription>
                </div>
              </div>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                  Unsaved Changes
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                AI Prompt Instructions
              </label>
              <Textarea
                value={editedPrompt}
                onChange={(event) => setEditedPrompt(event.target.value)}
                placeholder="Enter the AI moderation prompt..."
                className="min-h-[300px] font-mono text-sm"
                disabled={isLoadingState}
              />
            </div>

            {prompt ? (
              <div className="text-xs text-muted-foreground">
                Last updated: {prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleString() : 'Unknown'}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No system prompt is configured yet. Write one and save it, or reset to load the default prompt.
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={savePrompt}
                disabled={isLoadingState || !hasUnsavedChanges}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoadingState}
                    className="flex items-center gap-2"
                  >
                    {resetting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Reset to Default
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset prompt to default?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This replaces the current moderation prompt with the built-in default. Any unsaved edits are discarded. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resetPrompt()}>Confirm Reset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="ghost"
                onClick={loadPrompt}
                disabled={isLoadingState}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
