import { useState, useCallback } from 'react';

export interface UploadState {
  isUploading: boolean;
  error: string | null;
  progress: number;
}

export interface UseImageUploadReturn {
  uploadState: UploadState;
  uploadImage: (file: File) => Promise<string | null>;
  resetError: () => void;
}

/**
 * Reusable hook for uploading images to CDN
 * Returns CDN URL on success, null on failure
 */
export function useImageUpload(): UseImageUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
    progress: 0,
  });

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    // Validate file
    if (!file.type.startsWith('image/')) {
      setUploadState({ isUploading: false, error: 'Please select an image file', progress: 0 });
      return null;
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setUploadState({ isUploading: false, error: 'Image must be smaller than 20MB', progress: 0 });
      return null;
    }

    setUploadState({ isUploading: true, error: null, progress: 10 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      setUploadState({ isUploading: true, error: null, progress: 30 });

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });

      setUploadState({ isUploading: true, error: null, progress: 70 });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No URL returned from upload');
      }

      setUploadState({ isUploading: false, error: null, progress: 100 });

      return data.url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      setUploadState({ isUploading: false, error: errorMessage, progress: 0 });
      return null;
    }
  }, []);

  const resetError = useCallback(() => {
    setUploadState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    uploadState,
    uploadImage,
    resetError,
  };
}
