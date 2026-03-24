import { useState, useRef, useCallback } from 'react'
import './FileUpload.css'

const FileUpload = ({
  onFileSelect,
  acceptedTypes = ['.json', '.csv'],
  maxSizeMB = 50,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  const validateFile = useCallback((file) => {
    setError(null)

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`)
      return false
    }

    // Check file type
    const extension = '.' + file.name.split('.').pop().toLowerCase()
    if (!acceptedTypes.includes(extension)) {
      setError(`Invalid file type. Accepted: ${acceptedTypes.join(', ')}`)
      return false
    }

    return true
  }, [acceptedTypes, maxSizeMB])

  const handleFile = useCallback(async (file) => {
    if (!validateFile(file)) return

    try {
      const content = await readFileContent(file)
      const extension = '.' + file.name.split('.').pop().toLowerCase()

      setSelectedFile({
        name: file.name,
        size: file.size,
        type: extension,
      })

      if (onFileSelect) {
        onFileSelect({
          file,
          content,
          fileType: extension,
          fileName: file.name,
        })
      }
    } catch (err) {
      setError('Failed to read file. Please try again.')
      console.error('File read error:', err)
    }
  }, [validateFile, onFileSelect])

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleInputChange = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleClear = (e) => {
    e.stopPropagation()
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (onFileSelect) {
      onFileSelect(null)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="file-input-hidden"
          disabled={disabled}
        />

        {selectedFile ? (
          <div className="file-selected">
            <div className="file-icon">&#128196;</div>
            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">{formatFileSize(selectedFile.size)}</span>
            </div>
            <button className="file-clear-btn" onClick={handleClear} type="button">
              &#10005;
            </button>
          </div>
        ) : (
          <div className="file-upload-content">
            <div className="upload-icon">&#128228;</div>
            <p className="upload-text">
              <span className="upload-link">Click to upload</span> or drag and drop
            </p>
            <p className="upload-hint">
              {acceptedTypes.join(', ')} up to {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="file-upload-error">{error}</p>
      )}
    </div>
  )
}

export default FileUpload
