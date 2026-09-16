import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Laptop, Trash2, CheckCircle2, RefreshCw, Mail, Globe, Monitor, Key } from 'lucide-react';
import { DeviceAuthRecord } from '../types';
import { apiGetSecurityList, apiApproveDevice, apiRevokeDevice, apiRejectDevice } from '../services/api';

interface SecurityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDeviceId?: string;
  onCurrentDeviceRevoked?: () => void;
}

export const SecurityManagerModal: React.FC<SecurityManagerModalProps> = ({
  isOpen,
  onClose,
  currentDeviceId,
  onCurrentDeviceRevoked,
}) => {
  const [loading, setLoading] = useState(false);
  const [approvedDevices, setApprovedDevices] = useState<DeviceAuthRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DeviceAuthRecord[]>([]);
  const [notificationsLog, setNotificationsLog] = useState<any[]>([]);
  const [targetEmail, setTargetEmail] = useState('ashish.sattur@gmail.com');
  const [activeTab, setActiveTab] = useState<'devices' | 'pending' | 'notifications'>('devices');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchList = async () => {
    setLoading(true);
    const data = await apiGetSecurityList();
    setApprovedDevices(data.approved || []);
    setPendingRequests(data.pending || []);
    setNotificationsLog(data.notificationsLog || []);
    if (data.targetEmail) setTargetEmail(data.targetEmail);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen]);

  const handleApprove = async (reqItem: DeviceAuthRecord) => {
    setLoading(true);
    await apiApproveDevice({
      requestId: reqItem.id,
      deviceId: reqItem.deviceId,
      approvedBy: targetEmail,
    });
    setActionSuccess(`Authorized PC "${reqItem.stationName}" (IP: ${reqItem.ipAddress})`);
    setTimeout(() => setActionSuccess(''), 3000);
    await fetchList();
  };

  const handleReject = async (requestId: string) => {
    setLoading(true);
    await apiRejectDevice(requestId);
    setActionSuccess('Declined authorization request');
    setTimeout(() => setActionSuccess(''), 3000);
    await fetchList();
  };

  const handleRevoke = async (device: DeviceAuthRecord) => {
    if (window.confirm(`Revoke authorization for ${device.stationName} (${device.ipAddress})?`)) {
      setLoading(true);
      await apiRevokeDevice(device.deviceId, device.token);
      setActionSuccess(`Revoked authorization for ${device.stationName}`);
      setTimeout(() => setActionSuccess(''), 3000);
      if (device.deviceId === currentDeviceId) {
        onCurrentDeviceRevoked?.();
      }
      await fetchList();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 text-slate-100 font-sans max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Security & PC Access Control
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Ashish Sattur
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Authorized computers permitted to run the PC software • Notifications to {targetEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchList}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Refresh Devices"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-800"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-600/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {actionSuccess}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'devices'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Approved Computers ({approvedDevices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Pending Approvals ({pendingRequests.length})</span>
            {pendingRequests.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'notifications'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Audit Log ({notificationsLog.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {activeTab === 'devices' && (
            <div className="space-y-2">
              {approvedDevices.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Laptop className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No authorized PC computers registered yet.
                </div>
              ) : (
                approvedDevices.map((dev) => (
                  <div
                    key={dev.deviceId || dev.id}
                    className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{dev.stationName}</span>
                          {dev.deviceId === currentDeviceId && (
                            <span className="bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.2 rounded text-[10px] border border-blue-500/30">
                              Current Machine
                            </span>
                          )}
                          <span className="bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.2 rounded text-[10px] border border-emerald-500/30">
                            Approved (YES)
                          </span>
                        </div>
                        <div className="text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          <span className="text-amber-300 font-mono font-semibold">IP: {dev.ipAddress}</span>
                          <span>OS: {dev.os}</span>
                          <span>Browser: {dev.browser}</span>
                          <span>Approved: {dev.approvedAt || dev.requestedAt}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevoke(dev)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 font-medium text-xs flex items-center gap-1.5 transition-colors"
                      title="Revoke Permission"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-2">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-400" />
                  No pending access requests. All terminals are verified.
                </div>
              ) : (
                pendingRequests.map((reqItem) => (
                  <div
                    key={reqItem.id}
                    className="p-3.5 bg-slate-950/80 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ShieldAlert className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{reqItem.stationName}</span>
                          <span className="bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.2 rounded text-[10px] border border-amber-500/30">
                            Awaiting Ashish Sattur (YES)
                          </span>
                        </div>
                        <div className="text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          <span className="text-amber-300 font-mono font-bold">IP: {reqItem.ipAddress}</span>
                          <span>OS: {reqItem.os}</span>
                          <span>Browser: {reqItem.browser}</span>
                          <span>Requested: {reqItem.requestedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(reqItem)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-900/30 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>YES (Approve)</span>
                      </button>
                      <button
                        onClick={() => handleReject(reqItem.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-2">
              {notificationsLog.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No security notifications logged yet.
                </div>
              ) : (
                notificationsLog.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5 font-mono text-[11px]"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-semibold">
                      <span>To: {notif.to}</span>
                      <span className="text-slate-400">{new Date(notif.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-300 font-bold">{notif.subject}</div>
                    <pre className="text-slate-400 whitespace-pre-wrap font-sans text-xs bg-slate-900/60 p-2 rounded border border-slate-800/80">
                      {notif.body}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Security target: {targetEmail}</span>
          <span className="text-slate-400">Pure Cotton Retail Guard v2.0</span>
        </div>
      </div>
    </div>
  );
};
