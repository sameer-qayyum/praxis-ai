"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Upload, X, FileIcon, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url?: string
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void
  maxFiles?: number
}

export function FileUpload({ onFilesChange, maxFiles = 5 }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: UploadedFile[] = Array.from(fileList)
        .slice(0, maxFiles - files.length)
        .map((file) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          type: file.type,
          url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        }))

      const updatedFiles = [...files, ...newFiles]
      setFiles(updatedFiles)
      onFilesChange(updatedFiles)
    },
    [files, maxFiles, onFilesChange],
  )

  const removeFile = useCallback(
    (id: string) => {
      const updatedFiles = files.filter((file) => file.id !== id)
      setFiles(updatedFiles)
      onFilesChange(updatedFiles)
    },
    [files, onFilesChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="space-y-3">
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop files here, or{" "}
            <label className="text-blue-600 hover:text-blue-700 cursor-pointer underline">
              browse
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                accept="image/*,.pdf,.doc,.docx,.txt,.json,.csv"
              />
            </label>
          </p>
          <p className="text-xs text-gray-500">Support for images, documents, and data files</p>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              {file.type.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4 text-blue-500" />
              ) : (
                <FileIcon className="h-4 w-4 text-gray-500" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file.id)}
                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
