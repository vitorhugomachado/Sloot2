import React, { useId, useMemo, useState } from 'react';
import { Eye, ImagePlus, X } from 'lucide-react';
import MobileBookingHub from '../../pages/preview/MobileBookingHub';
import { WEEKDAY_LABELS } from '../../utils/bookingPage';
import './mobile-hub-settings.css';

function Field({ label, name, value, onChange, maxLength, multiline = false, placeholder }) {
  const controlProps = {
    value: value || '',
    maxLength,
    onChange: (event) => onChange(name, event.target.value),
    placeholder,
  };
  return (
    <label className="mobile-hub-settings__field">
      <span>{label}</span>
      {multiline ? <textarea {...controlProps} rows={3} /> : <input type="text" {...controlProps} />}
      {maxLength ? <small>{String(value || '').length}/{maxLength}</small> : null}
    </label>
  );
}

function toPreviewHours(rows) {
  return (rows || []).filter((row) => row.configured).map((row) => {
    const periods = [];
    if (row.isOpen) {
      if (row.breakStart && row.breakEnd) {
        periods.push({ start: row.opensAt, end: row.breakStart }, { start: row.breakEnd, end: row.closesAt });
      } else {
        periods.push({ start: row.opensAt, end: row.closesAt });
      }
    }
    return { ...row, periods };
  });
}

export default function MobileHubSettingsPanel({
  draft,
  onDraftChange,
  weeklyHours,
  onWeeklyHoursChange,
  media,
  pendingMedia,
  onPendingMediaChange,
  storageConfigured,
  businessInfo,
}) {
  const [uploadError, setUploadError] = useState('');
  const coverInputId = useId();
  const galleryInputId = useId();

  const existingGallery = useMemo(() => (
    (draft.galleryAssetIds || []).map((assetId) => ({ assetId, url: media.galleryById?.[assetId] })).filter((item) => item.url)
  ), [draft.galleryAssetIds, media.galleryById]);
  const galleryCount = (draft.galleryAssetIds || []).length + pendingMedia.gallery.length;
  const coverUrl = pendingMedia.cover?.url || (draft.coverAssetId ? media.coverUrl : '');
  const previewConfig = {
    ...draft,
    coverUrl,
    galleryUrls: [...existingGallery.map((item) => item.url), ...pendingMedia.gallery.map((item) => item.url)],
    weeklyHours: toPreviewHours(weeklyHours),
  };

  const updateField = (name, value) => {
    onDraftChange({ ...draft, [name]: value });
    setUploadError('');
  };

  const selectCover = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setUploadError('Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (pendingMedia.cover?.url) URL.revokeObjectURL(pendingMedia.cover.url);
    onPendingMediaChange({ ...pendingMedia, cover: { file, url: URL.createObjectURL(file) } });
    setUploadError('');
  };

  const selectGallery = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    const available = Math.max(0, 5 - galleryCount);
    if (!available) {
      setUploadError('A galeria aceita no máximo cinco imagens.');
      return;
    }
    if (files.some((file) => !file.type.startsWith('image/') || file.type === 'image/svg+xml')) {
      setUploadError('Selecione somente imagens JPG, PNG ou WebP.');
      return;
    }
    const additions = files.slice(0, available).map((file) => ({ file, url: URL.createObjectURL(file) }));
    onPendingMediaChange({ ...pendingMedia, gallery: [...pendingMedia.gallery, ...additions] });
    setUploadError(files.length > available ? 'Apenas as primeiras imagens disponíveis foram adicionadas.' : '');
  };

  const removeCover = () => {
    if (pendingMedia.cover?.url) URL.revokeObjectURL(pendingMedia.cover.url);
    onPendingMediaChange({ ...pendingMedia, cover: null });
    onDraftChange({ ...draft, coverAssetId: null });
  };

  const removeExistingGallery = (assetId) => {
    onDraftChange({ ...draft, galleryAssetIds: draft.galleryAssetIds.filter((id) => id !== assetId) });
  };

  const removePendingGallery = (index) => {
    const next = [...pendingMedia.gallery];
    const [removed] = next.splice(index, 1);
    if (removed?.url) URL.revokeObjectURL(removed.url);
    onPendingMediaChange({ ...pendingMedia, gallery: next });
  };

  const updateDay = (index, patch) => {
    onWeeklyHoursChange(weeklyHours.map((day, dayIndex) => (
      dayIndex === index ? { ...day, configured: true, ...patch } : day
    )));
  };

  return (
    <section className="mobile-hub-settings" aria-labelledby="mobile-hub-settings-title">
      <div className="mobile-hub-settings__intro">
        <h3 id="mobile-hub-settings-title">Página mobile de agendamento</h3>
        <p>Personalize textos, fotos e expediente. A página pública só muda ao usar “Salvar e publicar”.</p>
      </div>

      <div className="mobile-hub-settings__layout">
        <div className="mobile-hub-settings__editor">
          <div className="mobile-hub-settings__grid">
            <Field label="Título principal" name="heroTitle" value={draft.heroTitle} onChange={updateField} maxLength={120} placeholder="Agende seu horário" />
            <Field label="Texto principal" name="heroText" value={draft.heroText} onChange={updateField} maxLength={320} multiline />
            <Field label="Sobre o negócio" name="about" value={draft.about} onChange={updateField} maxLength={1000} multiline />
          </div>

          <div className="mobile-hub-settings__gallery-field">
            <div className="mobile-hub-settings__gallery-heading">
              <div><span>Foto de capa</span><small>JPG, PNG ou WebP; o servidor converte para WebP.</small></div>
              <label className={`mobile-hub-settings__upload${!storageConfigured ? ' mobile-hub-settings__upload--disabled' : ''}`} htmlFor={coverInputId}>
                <ImagePlus size={16} aria-hidden /> Escolher capa
              </label>
              <input id={coverInputId} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={!storageConfigured} onChange={selectCover} />
            </div>
            {coverUrl ? (
              <div className="mobile-hub-settings__cover-preview">
                <img src={coverUrl} alt="Prévia da capa" />
                <button type="button" onClick={removeCover} aria-label="Remover capa"><X size={15} /></button>
              </div>
            ) : null}
          </div>

          <div className="mobile-hub-settings__gallery-field">
            <div className="mobile-hub-settings__gallery-heading">
              <div><span>Galeria</span><small>Até cinco fotos.</small></div>
              <label className={`mobile-hub-settings__upload${!storageConfigured || galleryCount >= 5 ? ' mobile-hub-settings__upload--disabled' : ''}`} htmlFor={galleryInputId}>
                <ImagePlus size={16} aria-hidden /> Adicionar fotos
              </label>
              <input id={galleryInputId} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={!storageConfigured || galleryCount >= 5} onChange={selectGallery} />
            </div>
            {galleryCount ? (
              <div className="mobile-hub-settings__gallery-grid">
                {existingGallery.map((item) => (
                  <div className="mobile-hub-settings__gallery-item" key={item.assetId}>
                    <img src={item.url} alt="Foto publicada" />
                    <button type="button" onClick={() => removeExistingGallery(item.assetId)} aria-label="Remover foto"><X size={14} /></button>
                  </div>
                ))}
                {pendingMedia.gallery.map((item, index) => (
                  <div className="mobile-hub-settings__gallery-item" key={item.url}>
                    <img src={item.url} alt="Nova foto" />
                    <button type="button" onClick={() => removePendingGallery(index)} aria-label="Remover nova foto"><X size={14} /></button>
                  </div>
                ))}
              </div>
            ) : <p className="mobile-hub-settings__gallery-empty">A galeria fica oculta enquanto estiver vazia.</p>}
            {!storageConfigured ? <p className="mobile-hub-settings__error">O armazenamento de imagens não está configurado neste ambiente.</p> : null}
            {uploadError ? <p className="mobile-hub-settings__error" role="alert">{uploadError}</p> : null}
          </div>

          <div className="mobile-hub-settings__hours">
            <div className="mobile-hub-settings__hours-heading">
              <h4>Horário de funcionamento</h4>
              <p>Expediente institucional; feriados e bloqueios não alteram este resumo.</p>
            </div>
            {weeklyHours.map((day, index) => (
              <div className="mobile-hub-settings__day" key={day.dayOfWeek}>
                <label className="mobile-hub-settings__day-enabled">
                  <input type="checkbox" checked={day.configured} onChange={(event) => updateDay(index, { configured: event.target.checked })} />
                  <strong>{WEEKDAY_LABELS[day.dayOfWeek]}</strong>
                </label>
                <label><input type="checkbox" checked={day.isOpen} disabled={!day.configured} onChange={(event) => updateDay(index, { isOpen: event.target.checked })} /> Aberto</label>
                <input type="time" value={day.opensAt} disabled={!day.configured || !day.isOpen} onChange={(event) => updateDay(index, { opensAt: event.target.value })} aria-label={`Abertura ${WEEKDAY_LABELS[day.dayOfWeek]}`} />
                <input type="time" value={day.closesAt} disabled={!day.configured || !day.isOpen} onChange={(event) => updateDay(index, { closesAt: event.target.value })} aria-label={`Fechamento ${WEEKDAY_LABELS[day.dayOfWeek]}`} />
                <input type="time" value={day.breakStart} disabled={!day.configured || !day.isOpen} onChange={(event) => updateDay(index, { breakStart: event.target.value })} aria-label={`Início do intervalo ${WEEKDAY_LABELS[day.dayOfWeek]}`} />
                <input type="time" value={day.breakEnd} disabled={!day.configured || !day.isOpen} onChange={(event) => updateDay(index, { breakEnd: event.target.value })} aria-label={`Fim do intervalo ${WEEKDAY_LABELS[day.dayOfWeek]}`} />
              </div>
            ))}
          </div>
        </div>

        <aside className="mobile-hub-settings__preview" aria-label="Prévia mobile não interativa">
          <div className="mobile-hub-settings__preview-title"><Eye size={16} /> Prévia antes de publicar</div>
          <div className="mobile-hub-settings__preview-device">
            <MobileBookingHub config={previewConfig} businessInfo={businessInfo} interactive={false} />
          </div>
        </aside>
      </div>
    </section>
  );
}
