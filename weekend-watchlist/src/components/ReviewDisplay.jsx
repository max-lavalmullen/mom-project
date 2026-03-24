import { useState } from 'react'
import ReviewEditor from './ReviewEditor'
import './ReviewDisplay.css'

const ReviewDisplay = ({ review, reviewUpdatedAt, onSave, saving = false }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSave = async (newReview) => {
    await onSave(newReview)
    setIsEditing(false)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Truncate long reviews
  const maxPreviewLength = 150
  const isLongReview = review && review.length > maxPreviewLength
  const displayReview = isExpanded ? review : (review?.substring(0, maxPreviewLength) || '')

  if (isEditing) {
    return (
      <ReviewEditor
        initialReview={review || ''}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        saving={saving}
      />
    )
  }

  if (!review) {
    return (
      <div className="review-display empty">
        <button
          className="add-review-btn"
          onClick={() => setIsEditing(true)}
        >
          + Add a review
        </button>
      </div>
    )
  }

  return (
    <div className="review-display">
      <div className="review-content">
        <p className="review-text">
          {displayReview}
          {isLongReview && !isExpanded && '...'}
        </p>
        {isLongReview && (
          <button
            className="expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
      <div className="review-footer">
        {reviewUpdatedAt && (
          <span className="review-date">{formatDate(reviewUpdatedAt)}</span>
        )}
        <button
          className="edit-review-btn"
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
      </div>
    </div>
  )
}

export default ReviewDisplay
