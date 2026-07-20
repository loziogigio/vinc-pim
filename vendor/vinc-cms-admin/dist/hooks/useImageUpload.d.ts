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
 * Reusable hook for uploading images via the host adapter's uploadImage().
 * Returns the public URL on success, null on failure.
 */
export declare function useImageUpload(): UseImageUploadReturn;
//# sourceMappingURL=useImageUpload.d.ts.map