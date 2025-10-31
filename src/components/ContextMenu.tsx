import React from 'react';

interface Props {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ContextMenu({ x, y, onEdit, onDelete, onClose }: Props) {
  React.useEffect(() => {
    const close = () => onClose();
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [onClose]);

  return (
    <div 
      className="fixed bg-neutral-800 border border-neutral-600 rounded-md shadow-lg p-1 z-50" 
      style={{ top: y, left: x }}
    >
      <button onClick={onEdit} className="block w-full text-left px-2 py-1 hover:bg-neutral-700 text-sm">Muuda</button>
      <button onClick={onDelete} className="block w-full text-left px-2 py-1 hover:bg-neutral-700 text-sm text-red-400">Kustuta</button>
    </div>
  );
}
