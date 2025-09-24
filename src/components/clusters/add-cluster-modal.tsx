'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
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
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl && !urls.includes(trimmedUrl)) {
      setUrls([...urls, trimmedUrl]);
      setUrlInput('');
    }
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    setUrls(urls.filter(url => url !== urlToRemove));
  };

  const handleAddFromAvailable = (url: string) => {
    if (!urls.includes(url)) {
      setUrls([...urls, url]);
    }
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

  const availableUrlsNotSelected = availableUrls.filter(url => !urls.includes(url));

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
            <div className="flex space-x-2">
              <Input
                placeholder="Enter URL or path (e.g., /products/seo-tool)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
              />
              <Button onClick={handleAddUrl} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Selected URLs */}
          {urls.length > 0 && (
            <div className="space-y-2">
              <Label>Selected URLs ({urls.length})</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-32 overflow-y-auto">
                {urls.map((url) => (
                  <Badge key={url} variant="secondary" className="flex items-center gap-1">
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

          {/* Available URLs from Data */}
          {availableUrlsNotSelected.length > 0 && (
            <div className="space-y-2">
              <Label>Available URLs from Imported Data</Label>
              <div className="max-h-40 overflow-y-auto p-3 border rounded-lg">
                <div className="grid grid-cols-1 gap-1">
                  {availableUrlsNotSelected.slice(0, 20).map((url) => (
                    <div 
                      key={url}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                      onClick={() => handleAddFromAvailable(url)}
                    >
                      <span className="text-sm truncate flex-1">{url}</span>
                      <Plus className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                    </div>
                  ))}
                  {availableUrlsNotSelected.length > 20 && (
                    <div className="text-xs text-gray-500 p-2">
                      ... and {availableUrlsNotSelected.length - 20} more
                    </div>
                  )}
                </div>
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
