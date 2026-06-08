import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Extra } from '../types';
import {
  Sparkles,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function Extras() {
  const { extras, addExtra, updateExtra, deleteExtra } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    available: true,
  });

  const filteredExtras = useMemo(() => {
    return extras.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [extras, searchTerm]);

  const resetForm = () => {
    setFormData({ name: '', price: 0, available: true });
  };

  const handleAddExtra = () => {
    if (!formData.name.trim() || formData.price < 0) return;

    const newExtra: Extra = {
      id: `extra-${Date.now()}`,
      name: formData.name.trim(),
      price: formData.price,
      available: formData.available,
      createdAt: new Date(),
    };

    addExtra(newExtra);
    resetForm();
    setShowAddModal(false);
  };

  const handleEditExtra = () => {
    if (!editingExtra || !formData.name.trim() || formData.price < 0) return;

    updateExtra({
      ...editingExtra,
      name: formData.name.trim(),
      price: formData.price,
      available: formData.available,
    });
    resetForm();
    setEditingExtra(null);
  };

  const handleDeleteExtra = (extraId: string) => {
    if (confirm('Estas seguro de eliminar este extra?')) {
      deleteExtra(extraId);
    }
  };

  const toggleAvailability = (extra: Extra) => {
    updateExtra({ ...extra, available: !extra.available });
  };

  const startEdit = (extra: Extra) => {
    setEditingExtra(extra);
    setFormData({
      name: extra.name,
      price: extra.price,
      available: extra.available,
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingExtra(null);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Extras</h1>
              <p className="text-gray-400 text-sm">{extras.length} extras disponibles para los pedidos</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Extra
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-yellow-500 focus:outline-none"
            placeholder="Buscar extra..."
          />
        </div>

        {/* Extras List */}
        <div className="space-y-3">
          {filteredExtras.map(extra => (
            <div
              key={extra.id}
              className={`bg-gray-800 rounded-xl border ${
                extra.available ? 'border-gray-700' : 'border-red-700 border-dashed'
              } p-4 flex items-center justify-between gap-4`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => toggleAvailability(extra)}
                  className={`p-2 rounded-lg shrink-0 ${
                    extra.available
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                  title={extra.available ? 'Disponible' : 'No disponible'}
                >
                  {extra.available ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{extra.name}</p>
                  <p className="text-yellow-400 font-bold">+${extra.price.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(extra)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteExtra(extra.id)}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredExtras.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron extras</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingExtra) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingExtra ? 'Editar Extra' : 'Nuevo Extra'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none"
                  placeholder="Ej: Muzzarella extra"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Precio</label>
                <input
                  type="number"
                  value={formData.price || ''}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none"
                  placeholder="0"
                  min="0"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.available}
                  onChange={e => setFormData({ ...formData, available: e.target.checked })}
                  className="w-5 h-5 rounded text-yellow-500"
                />
                <span className="text-white">Disponible para pedidos</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingExtra ? handleEditExtra : handleAddExtra}
                className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingExtra ? 'Guardar Cambios' : 'Crear Extra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
