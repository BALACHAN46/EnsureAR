import React from 'react';
import { useNavigate } from 'react-router-dom';
import { hasCustomConfig } from '../../utils/modelConfig';

export default function ModelCard({ model, onToggleDelete }) {
  const navigate = useNavigate();
  const isCustomized = hasCustomConfig(model.id);

  const handleEdit = () => navigate(`/admin/model/${model.id}/edit`);
  const handlePreview = () => navigate(`/ar/${model.category}/${model.id}`);

  const canPreview = ['eyewear', 'watch', 'bracelets', 'rings', 'necklace', 'earrings', 'nosepin'].includes(model.category);

  return (
    <div className={`model-card ${model.deleted ? 'model-card--deleted' : ''}`} tabIndex={0}>
      <div className="model-card-media">
        {model.thumbnailPath ? (
          <img src={model.thumbnailPath} alt={model.name} loading="lazy" />
        ) : (
          <div className="model-card-thumb-placeholder">
            <span>{model.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {isCustomized && (
        <div className="model-card-badge" title="Custom tuning applied">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M11.828 2.25c-.910 0-1.780.361-2.425 1.006L3.53 9.12a.5.5 0 00-.133.26L3 12.25a.5.5 0 00.613.607l2.891-.867a.5.5 0 00.26-.133l5.864-5.873A3.433 3.433 0 0011.828 2.25zm-2.13 7.23l-2.13-2.13 3.7-3.7a1.934 1.934 0 012.132-.42l.008.004a1.934 1.934 0 01.42 3.02L9.698 9.48z" clipRule="evenodd"/>
          </svg>
          Tuned
        </div>
      )}

      <div className="model-card-overlay">
        <h3 className="model-card-name" title={model.name}>{model.name}</h3>

        <div className="model-card-details">
          <div className="model-card-meta">
            <span className="model-card-category">{model.category}</span>
            <span className="model-card-ext">
              {model.glbPath?.split('.').pop()?.toUpperCase() || 'GLB'}
            </span>
          </div>
          <p className="model-card-id">ID: {model.id.slice(0, 12)}…</p>

          <div className="model-card-actions">
            {!model.deleted && (
              <button
                id={`edit-model-${model.id}`}
                className="model-card-btn model-card-btn--edit"
                onClick={handleEdit}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                Edit
              </button>
            )}
            {!model.deleted && canPreview && (
              <button
                id={`preview-model-${model.id}`}
                className="model-card-btn model-card-btn--preview"
                onClick={handlePreview}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
                Try
              </button>
            )}
            <button
              className={`model-card-btn ${model.deleted ? 'model-card-btn--restore' : 'model-card-btn--delete'}`}
              onClick={(e) => { e.stopPropagation(); onToggleDelete?.(model.id, !model.deleted); }}
              style={{ backgroundColor: model.deleted ? 'rgba(80,200,120,0.15)' : 'rgba(239,68,68,0.15)', color: model.deleted ? '#50c878' : '#ef4444' }}
            >
              {model.deleted ? (
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
              )}
              {model.deleted ? 'Restore' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
