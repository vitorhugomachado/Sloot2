import React from "react";

export default function StripedMotionButton({
  children,
  isLoading = false,
  onClick,
  className = "",
  style,
  disabled = false,
  type = "button",
  loadingText = "Processando...",
  textStyle,
}) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={className}
      style={{
        opacity: isDisabled ? 0.9 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        ...style,
      }}
    >
      {isLoading ? <span style={textStyle}>{loadingText}</span> : children}
    </button>
  );
}
