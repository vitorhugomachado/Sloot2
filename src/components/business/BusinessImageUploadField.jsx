import React, { useId } from 'react';
import { Camera } from 'lucide-react';
import { compressImageFileToDataUrl } from '../../utils/compressImageFile';

export default function BusinessImageUploadField({
  label,
  hint,
  value,
  onChange,
  variant = 'square',
  maxEdge = 1200,
  placeholderInitial,
}) {
  const inputId = useId();
  const isBanner = variant === 'banner';

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um ficheiro de imagem (JPG, PNG, etc.).');
      return;
    }
    try {
      const dataUrl = await compressImageFileToDataUrl(file, maxEdge);
      onChange(dataUrl);
    } catch (err) {
      alert(err.message || 'Não foi possível carregar a imagem.');
    }
  };

  return (
    <div className={`biz-upload biz-upload--${variant}`}>
      <label htmlFor={inputId} className="biz-upload__label">
        {label}
      </label>
      {hint ? <p className="biz-upload__hint">{hint}</p> : null}
      <button
        type="button"
        className="biz-upload__trigger"
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {value ? (
          <img src={value} alt="" className="biz-upload__preview" />
        ) : (
          <span className="biz-upload__placeholder">
            <Camera size={isBanner ? 28 : 24} strokeWidth={1.75} aria-hidden />
            <span>{isBanner ? 'Carregar banner' : 'Carregar foto'}</span>
          </span>
        )}
        {!value && placeholderInitial ? (
          <span className="biz-upload__initial" aria-hidden>
            {placeholderInitial}
          </span>
        ) : null}
      </button>
      <input id={inputId} type="file" accept="image/*" hidden onChange={handleFile} />
      {value ? (
        <button type="button" className="biz-upload__remove" onClick={() => onChange(null)}>
          Remover imagem
        </button>
      ) : null}
    </div>
  );
}
