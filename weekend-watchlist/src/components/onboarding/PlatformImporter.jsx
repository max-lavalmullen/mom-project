import { useState } from 'react'
import { PLATFORM_IMPORT_INFO } from '../../services/parsers'
import { getExportInstructions, getAcceptedFileTypes } from '../../services/platformImport'
import FileUpload from '../FileUpload'
import ImportProgress from '../ImportProgress'
import './PlatformImporter.css'

const PlatformImporter = ({
  platforms = [],
  onImport,
  importStatuses = {},
}) => {
  const [activeTab, setActiveTab] = useState(platforms[0] || null)
  const [fileData, setFileData] = useState({}) // platform -> { content, fileType, fileName }
  const [importing, setImporting] = useState({}) // platform -> boolean
  const [progress, setProgress] = useState({}) // platform -> progress state
  const [showInstructions, setShowInstructions] = useState({}) // platform -> boolean

  const handleFileSelect = (platform, data) => {
    if (data) {
      setFileData(prev => ({
        ...prev,
        [platform]: {
          content: data.content,
          fileType: data.fileType,
          fileName: data.fileName,
        },
      }))
    } else {
      setFileData(prev => {
        const newData = { ...prev }
        delete newData[platform]
        return newData
      })
    }
  }

  const handleImport = async (platform) => {
    const data = fileData[platform]
    if (!data || importing[platform]) return

    setImporting(prev => ({ ...prev, [platform]: true }))
    setProgress(prev => ({
      ...prev,
      [platform]: { stage: 'validating', progress: 0, message: 'Starting import...' },
    }))

    try {
      await onImport(
        platform,
        data.content,
        data.fileType,
        (progressUpdate) => {
          setProgress(prev => ({
            ...prev,
            [platform]: progressUpdate,
          }))
        }
      )
    } catch (error) {
      setProgress(prev => ({
        ...prev,
        [platform]: {
          stage: 'error',
          progress: 0,
          message: 'Import failed',
          error: error.message,
        },
      }))
    } finally {
      setImporting(prev => ({ ...prev, [platform]: false }))
    }
  }

  const toggleInstructions = (platform) => {
    setShowInstructions(prev => ({
      ...prev,
      [platform]: !prev[platform],
    }))
  }

  if (platforms.length === 0) {
    return (
      <div className="platform-importer empty">
        <p>No platforms selected for import.</p>
      </div>
    )
  }

  return (
    <div className="platform-importer">
      <h3>Upload your watch history</h3>
      <p className="step-description">
        Follow the instructions below to export and upload your data from each platform.
      </p>

      {/* Platform tabs */}
      <div className="import-tabs">
        {platforms.map(platform => {
          const info = PLATFORM_IMPORT_INFO[platform]
          const status = importStatuses[platform]
          const isComplete = status?.status === 'completed' || progress[platform]?.stage === 'complete'

          return (
            <button
              key={platform}
              type="button"
              className={`import-tab ${activeTab === platform ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
              onClick={() => setActiveTab(platform)}
            >
              <span
                className="tab-dot"
                style={{ backgroundColor: info?.color }}
              />
              <span className="tab-name">{info?.name}</span>
              {isComplete && <span className="tab-check">&#10003;</span>}
            </button>
          )
        })}
      </div>

      {/* Active platform content */}
      {activeTab && (
        <div className="import-panel">
          {(() => {
            const info = PLATFORM_IMPORT_INFO[activeTab]
            const instructions = getExportInstructions(activeTab)
            const acceptedTypes = getAcceptedFileTypes(activeTab)
            const isImporting = importing[activeTab]
            const currentProgress = progress[activeTab]
            const isComplete = currentProgress?.stage === 'complete'
            const hasFile = !!fileData[activeTab]

            return (
              <>
                <div className="import-header">
                  <h4 style={{ color: info?.color }}>{info?.name}</h4>
                  <button
                    type="button"
                    className="instructions-toggle"
                    onClick={() => toggleInstructions(activeTab)}
                  >
                    {showInstructions[activeTab] ? 'Hide instructions' : 'How to export'}
                  </button>
                </div>

                {showInstructions[activeTab] && (
                  <div className="instructions-panel">
                    <ol className="instructions-list">
                      {instructions.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {currentProgress && (
                  <ImportProgress
                    stage={currentProgress.stage}
                    progress={currentProgress.progress}
                    message={currentProgress.message}
                    matched={currentProgress.matched}
                    total={currentProgress.total}
                    error={currentProgress.error}
                  />
                )}

                {!isComplete && !isImporting && (
                  <>
                    <FileUpload
                      onFileSelect={(data) => handleFileSelect(activeTab, data)}
                      acceptedTypes={acceptedTypes}
                      disabled={isImporting}
                    />

                    {hasFile && (
                      <button
                        type="button"
                        className="btn btn-primary import-btn"
                        onClick={() => handleImport(activeTab)}
                        disabled={isImporting}
                      >
                        Import from {info?.name}
                      </button>
                    )}
                  </>
                )}

                {isComplete && (
                  <div className="import-success">
                    <p>Successfully imported your {info?.name} watch history!</p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default PlatformImporter
