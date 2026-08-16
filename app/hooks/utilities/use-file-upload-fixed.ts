import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
} from "react";

export type FileWithPreview = {
  file: File;
  id: string;
  preview?: string;
};

export type FileUploadOptions = {
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  multiple?: boolean;
  onFilesAdded?: (files: FileWithPreview[]) => void;
  onError?: (errors: string[]) => void;
};

export const useFileUploadFixed = (
  options: FileUploadOptions = {},
) => {
  const {
    maxFiles = Number.POSITIVE_INFINITY,
    maxSize = Number.POSITIVE_INFINITY,
    accept = "*",
    multiple = false,
    onFilesAdded,
    onError,
  } = options;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFiles = useCallback(
    (files: File[]): { validFiles: File[]; errors: string[] } => {
      const validFiles: File[] = [];
      const errors: string[] = [];

      files.forEach((file) => {
        let hasError = false;

        // Check file size
        if (file.size > maxSize) {
          errors.push(`File "${file.name}" exceeds maximum size of ${formatBytes(maxSize)}.`);
          hasError = true;
        }

        // Check file type
        if (accept !== "*") {
          const acceptedTypes = accept.split(",").map((type) => type.trim());
          const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
          const fileType = file.type || "";

          const isAccepted = acceptedTypes.some((type) => {
            if (type.startsWith(".")) {
              return fileExtension === type.toLowerCase();
            }
            if (type.endsWith("/*")) {
              const baseType = type.split("/")[0];
              return fileType.startsWith(`${baseType}/`);
            }
            return fileType === type;
          });

          if (!isAccepted) {
            errors.push(`File "${file.name}" is not an accepted file type.`);
            hasError = true;
          }
        }

        if (!hasError) {
          validFiles.push(file);
        }
      });

      return { validFiles, errors };
    },
    [accept, maxSize],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      
      if (fileArray.length === 0) return;

      // Apply maxFiles limit
      let filesToProcess = fileArray;
      if (maxFiles !== Number.POSITIVE_INFINITY) {
        filesToProcess = fileArray.slice(0, maxFiles);
        if (fileArray.length > maxFiles) {
          setErrors([`You can only upload a maximum of ${maxFiles} files at once.`]);
          onError?.([`You can only upload a maximum of ${maxFiles} files at once.`]);
        }
      }

      const { validFiles, errors: validationErrors } = validateFiles(filesToProcess);

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        onError?.(validationErrors);
      }

      if (validFiles.length > 0) {
        const fileWithPreviews = validFiles.map((file) => ({
          file,
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        }));

        onFilesAdded?.(fileWithPreviews);
      }

      // Clear input for next selection
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [maxFiles, validateFiles, onFilesAdded, onError],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles],
  );

  const openFileDialog = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => ({
      ...props,
      type: "file" as const,
      onChange: handleFileChange,
      accept: props.accept || accept,
      multiple: props.multiple !== undefined ? props.multiple : multiple,
      ref: inputRef,
    }),
    [accept, multiple, handleFileChange],
  );

  return {
    isDragging,
    errors,
    openFileDialog,
    getInputProps,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
};

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Number.parseFloat((bytes / k ** i).toFixed(dm)) + sizes[i];
};