import { useState, useEffect } from 'react';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Textarea } from '@modl-gg/shared-web/components/ui/textarea';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import { RefreshCw, RotateCcw, Save, AlertTriangle, Brain, ShieldCheck } from 'lucide-react';
import {
  systemService,
  type PromptStrictnessLevel,
  type SystemPrompt,
} from '@/lib/services/system-service';

const strictnessLevelInfo: Record<PromptStrictnessLevel, {
  title: string;
  description: string;
  color: string;
  icon: JSX.Element;
}> = {
  lenient: {
    title: 'Lenient Mode',
    description: 'More forgiving approach - gives players benefit of doubt',
    color: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  standard: {
    title: 'Standard Mode',
    description: 'Balanced moderation - enforces rules fairly',
    color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    icon: <Brain className="h-4 w-4" />,
  },
  strict: {
    title: 'Strict Mode',
    description: 'Zero tolerance - proactive enforcement',
    color: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

export default function SystemPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PromptStrictnessLevel | null>(null);
  const [resetting, setResetting] = useState<PromptStrictnessLevel | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<PromptStrictnessLevel, string>>({
    lenient: '',
    standard: '',
    strict: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const loadedPrompts = await systemService.getSystemPrompts();
      setPrompts(loadedPrompts);

      const edited: Record<PromptStrictnessLevel, string> = {
        lenient: '',
        standard: '',
        strict: '',
      };

      loadedPrompts.forEach((prompt) => {
        edited[prompt.strictnessLevel] = prompt.prompt;
      });

      setEditedPrompts(edited);
    } catch (caught) {
      console.error('Error loading prompts:', caught);
      toast({
        title: 'Error',
        description: 'Failed to load system prompts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async (strictnessLevel: PromptStrictnessLevel) => {
    const editedPrompt = editedPrompts[strictnessLevel];
    if (!editedPrompt?.trim()) {
      toast({
        title: 'Error',
        description: 'Prompt cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(strictnessLevel);
      await systemService.updateSystemPrompt(strictnessLevel, editedPrompt);
      toast({
        title: 'Success',
        description: `Updated ${strictnessLevel} prompt`,
      });
      await loadPrompts();
    } catch (caught) {
      console.error('Error saving prompt:', caught);
      toast({
        title: 'Error',
        description: 'Failed to save prompt',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  const resetPrompt = async (strictnessLevel: PromptStrictnessLevel) => {
    if (!confirm(`Are you sure you want to reset the ${strictnessLevel} prompt to its default value? This action cannot be undone.`)) {
      return;
    }

    try {
      setResetting(strictnessLevel);
      await systemService.resetSystemPrompt(strictnessLevel);
      toast({
        title: 'Success',
        description: `Reset ${strictnessLevel} prompt`,
      });
      await loadPrompts();
    } catch (caught) {
      console.error('Error resetting prompt:', caught);
      toast({
        title: 'Error',
        description: 'Failed to reset prompt',
        variant: 'destructive',
      });
    } finally {
      setResetting(null);
    }
  };

  const handlePromptChange = (strictnessLevel: PromptStrictnessLevel, value: string) => {
    setEditedPrompts((previous) => ({
      ...previous,
      [strictnessLevel]: value,
    }));
  };

  const hasChanges = (strictnessLevel: PromptStrictnessLevel) => {
    const original = prompts.find((entry) => entry.strictnessLevel === strictnessLevel)?.prompt ?? '';
    const edited = editedPrompts[strictnessLevel] ?? '';
    return original !== edited;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading system prompts...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">AI System Prompts</h1>
          <p className="text-muted-foreground mt-1">Configure AI moderation prompts for different strictness levels</p>
        </div>
        <div className="grid gap-6">
          {(['lenient', 'standard', 'strict'] as const).map((level) => {
            const prompt = prompts.find((entry) => entry.strictnessLevel === level);
            const info = strictnessLevelInfo[level];
            const isLoadingState = saving === level || resetting === level;
            const hasUnsavedChanges = hasChanges(level);

            return (
              <Card key={level} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {info.icon}
                      <div>
                        <CardTitle className="text-xl">{info.title}</CardTitle>
                        <CardDescription>{info.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasUnsavedChanges && (
                        <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                          Unsaved Changes
                        </Badge>
                      )}
                      <Badge className={info.color}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      AI Prompt Instructions
                    </label>
                    <Textarea
                      value={editedPrompts[level] || ''}
                      onChange={(event) => handlePromptChange(level, event.target.value)}
                      placeholder={`Enter the AI prompt for ${level} moderation...`}
                      className="min-h-[300px] font-mono text-sm"
                      disabled={isLoadingState}
                    />
                  </div>

                  {prompt && (
                    <div className="text-xs text-muted-foreground">
                      Last updated: {prompt.updatedAt ? new Date(prompt.updatedAt).toLocaleString() : 'Unknown'}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => savePrompt(level)}
                      disabled={isLoadingState || !hasUnsavedChanges}
                      className="flex items-center gap-2"
                    >
                      {saving === level ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Changes
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => resetPrompt(level)}
                      disabled={isLoadingState}
                      className="flex items-center gap-2"
                    >
                      {resetting === level ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Reset to Default
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={loadPrompts}
                      disabled={isLoadingState}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
