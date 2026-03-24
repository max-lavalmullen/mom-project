import { useState } from 'react'
import './ReviewEditor.css'

const ReviewEditor = ({ initialReview = '', onSave, onCancel, saving = false }) => {
  const [review, setReview] = useState(initialReview)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(review.trim())
  }

  const characterCount = review.length
  const maxCharacters = 2000

  return (
    <form className="review-editor" onSubmit={handleSubmit}>
      <textarea
        className="review-textarea"
        placeholder="Write your thoughts about this..."
        value={review}
        onChange={(e) => setReview(e.target.value)}
        maxLength={maxCharacters}
        rows={4}
        disabled={saving}
      />
      <div className="review-editor-footer">
        <span className="character-count">
          {characterCount}/{maxCharacters}
        </span>
        <div className="review-editor-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Review'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default ReviewEditor
