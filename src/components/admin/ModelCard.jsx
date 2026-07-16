import React from 'react';
import { useRouter } from '../../router';
import { hasCustomConfig } from '../../utils/modelConfig';

export default function ModelCard({ model }) {
  const { navigate } = useRouter();
  const isCustomized = hasCustomConfig(model.id);

  const handleEdit = () => navigate(`/admin/model/${model.id}/edit`);
  const handlePreview = () => navigate(`/ar/${model.category}/${model.id}`);

  return (
    <div className="model-card">
      <div className="model-card-thumb">
        {model.thumbnailPath ? (
          <img src={model.thumbnailPath} alt={model.name} loading="lazy" />
        ) : (
          <div className="model-card-thumb-placeholder">
            <span>{model.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {isCustomized && (
          <div className="model-card-badge" title="Custom tuning applied">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M11.828 2.25c-.910 0-1.780.361-2.425 1.006L3.53 9.12a.5.5 0 00-.133.26L3 12.25a.5.5 0 00.613.607l2.891-.867a.5.5 0 00.26-.133l5.864-5.873A3.433 3.433 0 0011.828 2.25zm-2.13 7.23l-2.13-2.13 3.7-3.7a1.934 1.934 0 012.132-.42l.008.004a1.934 1.934 0 01.42 3.02L9.698 9.48z" clipRule="evenodd"/>
            </svg>
            Tuned
          </div>
        )}
      </div>

      <div className="model-card-body">
        <div className="model-card-meta">
          <span className="model-card-category">{model.category}</span>
          <span className="model-card-ext">
            {model.glbPath?.split('.').pop()?.toUpperCase() || 'GLB'}
          </span>
        </div>
        <h3 className="model-card-name" title={model.name}>{model.name}</h3>
        <p className="model-card-id">ID: {model.id.slice(0, 12)}…</p>
      </div>

      <div className="model-card-actions">
        <button
          id={`edit-model-${model.id}`}
          className="model-card-btn model-card-btn--edit"
          onClick={handleEdit}
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
          </svg>
          Edit Config
        </button>
        {['eyewear', 'watch', 'bracelets', 'rings', 'necklace', 'earrings', 'nosepin'].includes(model.category) && (
          <button
            id={`preview-model-${model.id}`}
            className="model-card-btn model-card-btn--preview"
            onClick={handlePreview}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
            </svg>
            Try On
          </button>
        )}
      </div>
    </div>
  );
}
