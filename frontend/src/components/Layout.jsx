import React from 'react';
import Cursor from './Cursor';
import Loader from './Loader';

export default function Layout({ children }) {
  return (
    <>
      <Loader />
      <Cursor />
      <div className="min-h-screen bg-dark selection:bg-primary/30 text-slate-100 overflow-x-hidden font-sans relative">
        {/* Dynamic Premium Gradients */}
        <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-dark to-dark pointer-events-none" />
        <div className="fixed inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-soft-light" />
        <div className="fixed inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDBoMXY0MEgweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIvPjxwYXRoIGQ9Ik0wIDBoNDB2MUgweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIvPjwvc3ZnPg==')] opacity-30 pointer-events-none" />

        <div className="relative z-10">
          {children}
        </div>
      </div>
    </>
  );
}
