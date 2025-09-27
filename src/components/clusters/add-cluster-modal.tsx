'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { PerformanceCluster } from '@/lib/types';

interface AddClusterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (cluster: Omit<PerformanceCluster, 'id' | 'createdAt' | 'updatedAt'>) => void;
  availableUrls: string[];
}

export function AddClusterModal({ 
  open, 
  onOpenChange, 
  onSave, 
  availableUrls 
}: AddClusterModalProps) {
  const [name, setName] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');

  const handleAddUrl = () => {
    const input = urlInput.trim();
    if (!input) return;

    // Check if input contains multiple URLs (separated by newlines, commas, or semicolons)
    const urlList = input
      .split(/[\n,;]+/) // Split by newlines, commas, or semicolons
      .map(url => url.trim())
      .filter(url => url.length > 0); // Remove empty strings

    if (urlList.length > 1) {
      // Bulk add: add all URLs that aren't already in the list
      const newUrls = urlList.filter(url => !urls.includes(url));
      if (newUrls.length > 0) {
        setUrls([...urls, ...newUrls]);
      }
    } else {
      // Single URL: add if not already in the list
      const singleUrl = urlList[0];
      if (singleUrl && !urls.includes(singleUrl)) {
        setUrls([...urls, singleUrl]);
      }
    }
    
    setUrlInput('');
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    setUrls(urls.filter(url => url !== urlToRemove));
  };


  const handleSave = () => {
    if (name.trim() && urls.length > 0) {
      onSave({
        name: name.trim(),
        urls,
      });
      // Reset form
      setName('');
      setUrls([]);
      setUrlInput('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setUrls([]);
    setUrlInput('');
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Performance Cluster</DialogTitle>
          <DialogDescription>
            Group URLs together to analyze their combined performance metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cluster Name */}
          <div className="space-y-2">
            <Label htmlFor="cluster-name">Cluster Name</Label>
            <Input
              id="cluster-name"
              placeholder="e.g., Product Pages, Blog Posts, Landing Pages"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Add URLs */}
          <div className="space-y-2">
            <Label>URLs</Label>
            <div className="space-y-2">
              <Textarea
                placeholder="Enter URLs (one per line, or separated by commas/semicolons)&#10;Examples:&#10;/products/seo-tool&#10;/blog/keyword-research&#10;/landing-pages/analytics"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                rows={4}
                className="resize-none"
              />
              <Button onClick={handleAddUrl} size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add URL(s)
              </Button>
              <p className="text-xs text-gray-500">
                Tip: Paste multiple URLs separated by new lines, commas, or semicolons. Press Ctrl+Enter to add.
              </p>
            </div>
          </div>

          {/* Selected URLs */}
          {urls.length > 0 && (
            <div className="space-y-2">
              <Label>Selected URLs ({urls.length})</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-32 overflow-y-auto">
                {urls.map((url, index) => (
                  <Badge key={`${url}-${index}`} variant="secondary" className="flex items-center gap-1">
                    {url}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-red-500" 
                      onClick={() => handleRemoveUrl(url)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name.trim() || urls.length === 0}
          >
            Create Cluster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
