import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@modl-gg/shared-web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@modl-gg/shared-web/components/ui/card';
import { Textarea } from '@modl-gg/shared-web/components/ui/textarea';
import { Badge } from '@modl-gg/shared-web/components/ui/badge';
import { useToast } from '@modl-gg/shared-web/hooks/use-toast';
import { RefreshCw, RotateCcw, Save, AlertTriangle, Brain, ShieldCheck, ArrowLeft, Settings } from 'lucide-react';
import { apiClient } from '../lib/api';

interface SystemPrompt {
  _id: string;
  strictnessLevel: 'lenient' | 'standard' | 'strict';
  prompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const strictnessLevelInfo = {
  lenient: {
    title: 'Lenient Mode',
    description: 'More forgiving approach - gives players benefit of doubt',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <ShieldCheck className="h-4 w-4" />
  },
  standard: {
    title: 'Standard Mode',
    description: 'Balanced moderation - enforces rules fairly',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Brain className="h-4 w-4" />
  },
  strict: {
    title: 'Strict Mode',
    description: 'Zero tolerance - proactive enforcement',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <AlertTriangle className="h-4 w-4" />
  }
};

export default function SystemPromptsPage() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSystemPrompts();
      if (response.success) {
        setPrompts(response.data);
        // Initialize edited prompts with current values
        const edited: Record<string, string> = {};
        response.data.forEach((prompt: SystemPrompt) => {
          edited[prompt.strictnessLevel] = prompt.prompt;
        });
        setEditedPrompts(edited);
      } else {
        toast({
          title: "Error",
          description: "Failed to load system prompts",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async (strictnessLevel: 'lenient' | 'standard' | 'strict') => {
    const editedPrompt = editedPrompts[strictnessLevel];
    if (!editedPrompt?.trim()) {
      toast({
        title: "Error",
        description: "Prompt cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(strictnessLevel);
      const response = await apiClient.updateSystemPrompt(strictnessLevel, editedPrompt);
      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        await loadPrompts(); // Reload to get updated data
      } else {
        toast({
          title: "Error", 
          description: response.error || "Failed to save prompt",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const resetPrompt = async (strictnessLevel: 'lenient' | 'standard' | 'strict') => {
    if (!confirm(`Are you sure you want to reset the ${strictnessLevel} prompt to its default value? This action cannot be undone.`)) {
      return;
    }

    try {
      setResetting(strictnessLevel);
      const response = await apiClient.resetSystemPrompt(strictnessLevel);
      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        await loadPrompts(); // Reload to get updated data
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to reset prompt",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error resetting prompt:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setResetting(null);
    }
  };

  const handlePromptChange = (strictnessLevel: string, value: string) => {
    setEditedPrompts(prev => ({
      ...prev,
      [strictnessLevel]: value
    }));
  };

  const hasChanges = (strictnessLevel: string) => {
    const original = prompts.find(p => p.strictnessLevel === strictnessLevel)?.prompt || '';
    const edited = editedPrompts[strictnessLevel] || '';
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/system">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to System Config
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <Settings className="h-6 w-6 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">AI System Prompts</h1>
                  <p className="text-sm text-muted-foreground">Configure AI moderation prompts for different strictness levels</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <div className="grid gap-6">
        {(['lenient', 'standard', 'strict'] as const).map((level) => {
          const prompt = prompts.find(p => p.strictnessLevel === level);
          const info = strictnessLevelInfo[level];
          const isLoading = saving === level || resetting === level;
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
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
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
                    onChange={(e) => handlePromptChange(level, e.target.value)}
                    placeholder={`Enter the AI prompt for ${level} moderation...`}
                    className="min-h-[300px] font-mono text-sm"
                    disabled={isLoading}
                  />
                </div>

                {prompt && (
                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(prompt.updatedAt).toLocaleString()}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => savePrompt(level)}
                    disabled={isLoading || !hasUnsavedChanges}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
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

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">About AI System Prompts</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• These prompts control how the AI analyzes chat messages for rule violations</p>
          <p>• Each strictness level determines how aggressive the AI moderation will be</p>
          <p>• Changes take effect immediately for new ticket analyses</p>
          <p>• Prompts should include clear guidelines for JSON response format</p>
          <p>• Test changes carefully to ensure appropriate moderation behavior</p>
        </div>
        </div>
      </div>
    </div>
  );
} 