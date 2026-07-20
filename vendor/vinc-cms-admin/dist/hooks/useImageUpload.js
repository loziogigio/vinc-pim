"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useImageUpload = useImageUpload;
const react_1 = require("react");
const adapter_js_1 = require("../adapter.js");
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
/**
 * Reusable hook for uploading images via the host adapter's uploadImage().
 * Returns the public URL on success, null on failure.
 */
function useImageUpload() {
    const { uploadImage: adapterUpload } = (0, adapter_js_1.useCmsAdmin)();
    const [uploadState, setUploadState] = (0, react_1.useState)({
        isUploading: false,
        error: null,
        progress: 0,
    });
    const uploadImage = (0, react_1.useCallback)(async (file) => {
        // Validate file
        if (!file.type.startsWith('image/')) {
            setUploadState({ isUploading: false, error: 'Please select an image file', progress: 0 });
            return null;
        }
        if (file.size > MAX_SIZE) {
            setUploadState({ isUploading: false, error: 'Image must be smaller than 20MB', progress: 0 });
            return null;
        }
        setUploadState({ isUploading: true, error: null, progress: 10 });
        try {
            const url = await adapterUpload(file);
            if (!url) {
                throw new Error('No URL returned from upload');
            }
            setUploadState({ isUploading: false, error: null, progress: 100 });
            return url;
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
            setUploadState({ isUploading: false, error: errorMessage, progress: 0 });
            return null;
        }
    }, [adapterUpload]);
    const resetError = (0, react_1.useCallback)(() => {
        setUploadState((prev) => ({ ...prev, error: null }));
    }, []);
    return {
        uploadState,
        uploadImage,
        resetError,
    };
}
//# sourceMappingURL=useImageUpload.js.map