import React, { useState } from 'react';
import { Supplier, Product } from '../types';
import { Users, Phone, Mail, MapPin, Star, Plus, Package, ExternalLink, X } from 'lucide-react';

interface SupplierManagementProps {
  suppliers: Supplier[];
  products: Product[];
  onAddSupplier: (supplier: Supplier) => void;
}

export const SupplierManagement: React.FC<SupplierManagementProps> = ({
  suppliers,
  products,
  onAddSupplier,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [rating, setRating] = useState(4.8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newSupplier: Supplier = {
      id: 'sup-' + Date.now(),
      name: name.trim(),
      contactPerson: contactPerson.trim() || 'Manager',
      phone: phone.trim() || '+91 90000 00000',
      email: email.trim() || `${name.toLowerCase().replace(/\s/g, '')}@example.com`,
      city: city.trim() || 'Textile Hub',
      specialty: specialty.trim() || 'Pure Cotton Weaving & Block Prints',
      rating: Number(rating) || 4.5,
    };

    onAddSupplier(newSupplier);
    setIsModalOpen(false);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCity('');
    setSpecialty('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">Textile Loom &amp; Artisan Supplier Network</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage weavers, printing houses, and wholesale cotton fabric suppliers for direct replenishment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" /> Add New Supplier
        </button>
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => {
          const suppliedProducts = products.filter((p) => p.supplierId === sup.id);
          const totalStockFromSupplier = suppliedProducts.reduce((sum, p) => sum + p.stock, 0);

          return (
            <div
              key={sup.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{sup.name}</h4>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {sup.city}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{sup.rating}</span>
                  </div>
                </div>

                <div className="mt-3 p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-950">
                  <span className="font-semibold block text-[11px] uppercase tracking-wider text-emerald-800">
                    Specialty &amp; Weave Expertise
                  </span>
                  {sup.specialty}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-400 w-16">Contact:</span>
                    <span className="font-semibold text-slate-800">{sup.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${sup.phone}`} className="text-emerald-700 hover:underline font-mono">
                      {sup.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600 truncate">{sup.email}</span>
                  </div>
                </div>
              </div>

              {/* Linked styles */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-500">
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    <strong>{suppliedProducts.length}</strong> active styles ({totalStockFromSupplier} pcs in store)
                  </span>
                </div>
                <a
                  href={`tel:${sup.phone}`}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-[11px] transition-colors"
                >
                  Quick Reorder Call
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">Add New Textile Supplier / Loom</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Loom Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bagru Natural Dye Printers Guild"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Ramesh Chandra"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Jaipur, Rajasthan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sales@loom.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cotton Fabric Specialty</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Organic Mulmul handblock prints, Indigo Dabu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
