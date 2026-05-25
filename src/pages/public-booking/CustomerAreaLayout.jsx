import React from 'react';
import { Outlet } from 'react-router-dom';
import SlootiBrandHeader from '../../components/brand/SlootiBrandHeader';
import './customer-area-layout.css';

/**
 * Layout das rotas públicas /:tenant — barra da marca slooti + conteúdo da página.
 */
export default function CustomerAreaLayout() {
  return (
    <div className="customer-area-layout">
      <SlootiBrandHeader />
      <div className="customer-area-layout__body">
        <Outlet />
      </div>
    </div>
  );
}
