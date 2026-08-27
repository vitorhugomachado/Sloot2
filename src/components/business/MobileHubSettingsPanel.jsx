import React, { useId, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  clearMobileHubConfig,
  DEFAULT_MOBILE_HUB_CONFIG,
  readMobileHubConfig,
  saveMobileHubConfig,
} from '../../utils/mobileHubConfig';
import { compressImageFileToDataUrl } from '../../utils/compressImageFile';
import './mobile-hub-settings.css';

function Field({ label, name, value, onChange, multiline = false, placeholder }) {
  const controlProps = {
    value: value || '',
    onChange: (event) => onChange(name, event.target.value),
    placeholder,
  };

  return (
    <label className="mobile-hub-settings__field">
      <span>{label}</span>
      {multiline ? <textarea {...controlProps} rows={3} /> : <input type="text" {...controlProps} />}
    </label>
  );
}

export default function MobileHubSettingsPanel({ slug }) {
  const [draft, setDraft] = useState(() => readMobileHubConfig(slug));
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const galleryInputId = useId();

  const galleryUrls = String(draft.gallery || '')
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  const updateField = (name, value) => {
    setDraft((previous) => ({ ...previous, [name]: value }));
    setSaved(false);
    setUploadError('');
  };

  const handleGalleryUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const availableSlots = Math.max(0, 5 - galleryUrls.length);
    if (!availableSlots) {
      setUploadError('O hub exibe no máximo 5 fotos na galeria.');
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    if (selectedFiles.some((file) => !file.type.startsWith('image/'))) {
      setUploadError('Selecione somente arquivos de imagem.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const uploadedUrls = await Promise.all(
        selectedFiles.map((file) => compressImageFileToDataUrl(file, 1200, 0.82)),
      );
      updateField('gallery', [...galleryUrls, ...uploadedUrls].join('\n'));
    } catch (error) {
      setUploadError(error?.message || 'Não foi possível carregar as fotos.');
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryPhoto = (index) => {
    updateField('gallery', galleryUrls.filter((_, photoIndex) => photoIndex !== index).join('\n'));
  };

  const handleSave = () => {
    saveMobileHubConfig(slug, draft);
    setSaved(true);
  };

  const handleReset = () => {
    clearMobileHubConfig(slug);
    setDraft({ ...DEFAULT_MOBILE_HUB_CONFIG });
    setSaved(true);
    setUploadError('');
  };

  return (
    <section className="mobile-hub-settings" aria-labelledby="mobile-hub-settings-title">
      <div className="mobile-hub-settings__intro">
        <h3 id="mobile-hub-settings-title">Hub da página de agendamento</h3>
        <p>Personalize aqui os textos e imagens exibidos na experiência mobile. A prévia não possui ferramentas de edição.</p>
      </div>

      <div className="mobile-hub-settings__grid">
        <Field label="Título principal" name="heroTitle" value={draft.heroTitle} onChange={updateField} />
        <Field label="Texto principal" name="heroText" value={draft.heroText} onChange={updateField} multiline />
        <Field label="Sobre a barbearia" name="about" value={draft.about} onChange={updateField} multiline />
        <div className="mobile-hub-settings__row">
          <Field label="Avaliação" name="rating" value={draft.rating} onChange={updateField} placeholder="4,9" />
          <Field label="Avaliações" name="reviews" value={draft.reviews} onChange={updateField} placeholder="204 avaliações" />
        </div>
        <div className="mobile-hub-settings__row">
          <Field label="Cidade" name="city" value={draft.city} onChange={updateField} placeholder="São Paulo, SP" />
          <Field label="Horários" name="hours" value={draft.hours} onChange={updateField} placeholder="Seg à Sáb · 09h às 20h" />
        </div>
        <Field label="URL da foto de capa" name="coverUrl" value={draft.coverUrl} onChange={updateField} placeholder="https://..." />
        <div className="mobile-hub-settings__gallery-field">
          <div className="mobile-hub-settings__gallery-heading">
            <div>
              <span>Fotos da galeria</span>
              <small>Envie até 5 fotos para exibir no hub.</small>
            </div>
            <label className={`mobile-hub-settings__upload${uploading ? ' mobile-hub-settings__upload--disabled' : ''}`} htmlFor={galleryInputId}>
              <ImagePlus size={16} aria-hidden />
              {uploading ? 'Carregando…' : 'Enviar fotos'}
            </label>
            <input
              id={galleryInputId}
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={uploading}
              onChange={handleGalleryUpload}
            />
          </div>
          {galleryUrls.length ? (
            <div className="mobile-hub-settings__gallery-grid">
              {galleryUrls.slice(0, 5).map((url, index) => (
                <div className="mobile-hub-settings__gallery-item" key={`${url}-${index}`}>
                  <img src={url} alt={`Foto ${index + 1} da galeria`} />
                  <button type="button" onClick={() => removeGalleryPhoto(index)} aria-label={`Remover foto ${index + 1}`}>
                    <X size={14} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mobile-hub-settings__gallery-empty">Nenhuma foto enviada ainda.</p>
          )}
          {uploadError ? <p className="mobile-hub-settings__error" role="alert">{uploadError}</p> : null}
        </div>
      </div>

      <div className="mobile-hub-settings__actions">
        <button type="button" className="mobile-hub-settings__reset" onClick={handleReset}>Restaurar padrão</button>
        <button type="button" className="btn-primary mobile-hub-settings__save" onClick={handleSave} disabled={uploading}>Salvar hub</button>
      </div>
      {saved ? <p className="mobile-hub-settings__status" role="status">Alterações salvas neste navegador.</p> : null}
    </section>
  );
}
