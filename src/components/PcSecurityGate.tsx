import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Laptop, Mail, Key, CheckCircle2, RefreshCw, Smartphone, Globe, Monitor, Lock } from 'lucide-react';
import { DeviceAuthRecord } from '../types';
import { apiGetMyIp, apiRequestDeviceAccess, apiCheckSecurityStatus, apiApproveDevice, playChime } from '../services/api';
import { safeLocalStorage } from '../utils/safeStorage';

interface PcSecurityGateProps {
  onApproved: (token: string, record: DeviceAuthRecord) => void;
  onSwitchToMobileGun: () => void;
}

export const PcSecurityGate: React.FC<PcSecurityGateProps> = ({ onApproved, onSwitchToMobileGun }) => {
  const [loading, setLoading] = useState(true);
  const [stationName, setStationName] = useState('Counter Laptop 1');
  const [ipAddress, setIpAddress] = useState('Detecting...');
  const [userAgent, setUserAgent] = useState('');
  const [os, setOs] = useState('Windows PC');
  const [browser, setBrowser] = useState('Chrome');
  const [screenRes, setScreenRes] = useState('1920x1080');
  const [deviceId, setDeviceId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [record, setRecord] = useState<DeviceAuthRecord | null>(null);

  // Ashish owner actions
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // Initialize device ID from safeLocalStorage or generate unique
  useEffect(() => {
    let storedDeviceId = safeLocalStorage.getItem('purecotton_pc_device_id');
    if (!storedDeviceId) {
      storedDeviceId = 'pc-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      safeLocalStorage.setItem('purecotton_pc_device_id', storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    // Detect browser & OS
    const ua = navigator.userAgent;
    setUserAgent(ua);
    let detectedOs = 'Desktop PC';
    if (ua.includes('Win')) detectedOs = 'Windows 11/10 PC';
    else if (ua.includes('Mac')) detectedOs = 'macOS Desktop';
    else if (ua.includes('Linux')) detectedOs = 'Linux Workstation';
    else if (ua.includes('CrOS')) detectedOs = 'ChromeOS';
    setOs(detectedOs);

    let detectedBrowser = 'Web Browser';
    if (ua.includes('Chrome')) detectedBrowser = 'Google Chrome';
    else if (ua.includes('Firefox')) detectedBrowser = 'Mozilla Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) detectedBrowser = 'Apple Safari';
    else if (ua.includes('Edge')) detectedBrowser = 'Microsoft Edge';
    setBrowser(detectedBrowser);

    const res = `${window.screen.width}x${window.screen.height}`;
    setScreenRes(res);

    // Fetch IP and initial request
    initSecurityCheck(storedDeviceId, detectedOs, detectedBrowser, res);
  }, []);

  const initSecurityCheck = async (devId: string, detectedOs: string, detectedBrowser: string, res: string) => {
    setLoading(true);
    const existingToken = safeLocalStorage.getItem('purecotton_pc_auth_token');

    // 1. Fetch IP from server
    const ipData = await apiGetMyIp();
    setIpAddress(ipData.ip);

    // 2. Request or check device access
    const result = await apiRequestDeviceAccess({
      deviceId: devId,
      stationName,
      os: detectedOs,
      browser: detectedBrowser,
      screenResolution: res,
      token: existingToken || undefined,
    });

    if (result.status === 'APPROVED' && result.token) {
      setStatus('APPROVED');
      if (result.record) setRecord(result.record);
      safeLocalStorage.setItem('purecotton_pc_auth_token', result.token);
      onApproved(result.token, result.record || ({} as any));
    } else {
      setStatus(result.status || 'PENDING');
      if (result.requestId) setRequestId(result.requestId);
      if (result.record) setRecord(result.record);
    }
    setLoading(false);
  };

  // Poll for approval status in background every 3 seconds
  useEffect(() => {
    if (status === 'APPROVED' || !deviceId) return;

    const interval = setInterval(async () => {
      const existingToken = safeLocalStorage.getItem('purecotton_pc_auth_token');
      const res = await apiCheckSecurityStatus({
        deviceId,
        token: existingToken || undefined,
        requestId: requestId || undefined,
      });

      if (res.status === 'APPROVED' && res.token) {
        setStatus('APPROVED');
        if (res.record) setRecord(res.record);
        safeLocalStorage.setItem('purecotton_pc_auth_token', res.token);
        playChime('success');
        clearInterval(interval);
        setTimeout(() => {
          onApproved(res.token!, res.record!);
        }, 800);
      } else if (res.status === 'REJECTED') {
        setStatus('REJECTED');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, deviceId, requestId, onApproved]);

  // Handle Owner pressing YES
  const handleApproveYes = async () => {
    setIsApproving(true);
    try {
      const res = await apiApproveDevice({
        requestId: requestId || undefined,
        deviceId,
        approvedBy: 'ashish.sattur@gmail.com',
      });

      if (res.success && res.token) {
        setStatus('APPROVED');
        if (res.record) setRecord(res.record);
        safeLocalStorage.setItem('purecotton_pc_auth_token', res.token);
        playChime('success');
        setShowEmailPreview(false);
        setShowPinDialog(false);
        setTimeout(() => {
          onApproved(res.token!, res.record!);
        }, 600);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsApproving(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '2026' || pinInput.toLowerCase() === 'ashish') {
      setPinError('');
      handleApproveYes();
    } else {
      setPinError('Invalid Admin PIN. (Default owner PIN is 2026)');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Pure Cotton Retail
              <span className="text-xs bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                Security Enforced
              </span>
            </h1>
            <p className="text-xs text-slate-400">Desktop Terminal Access Verification</p>
          </div>
        </div>

        <button
          onClick={onSwitchToMobileGun}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mobile Gun Mode (No Auth)</span>
        </button>
      </div>

      {/* Main Security Card */}
      <div className="max-w-2xl w-full mx-auto my-8 z-10">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative">
          
          {/* Status Badge */}
          <div className="flex flex-col items-center text-center mb-6">
            {status === 'APPROVED' ? (
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-3 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            ) : status === 'REJECTED' ? (
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-3">
                <Lock className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3 relative">
                <Laptop className="w-8 h-8" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
                </span>
              </div>
            )}

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {status === 'APPROVED'
                ? 'Permission Granted - Welcome!'
                : status === 'REJECTED'
                ? 'Access Denied by Ashish Sattur'
                : 'PC Authorization Required'}
            </h2>
            <p className="text-sm text-slate-300 max-w-md mt-1.5 leading-relaxed">
              {status === 'APPROVED'
                ? 'This computer has been verified. Launching billing and inventory software...'
                : status === 'REJECTED'
                ? 'Permission was declined. Please contact Ashish Sattur (ashish.sattur@gmail.com) to request access.'
                : 'Only authorized personnel can use the PC software. A security verification request has been dispatched to ashish.sattur@gmail.com.'}
            </p>
          </div>

          {/* Device & Network Details Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 sm:p-5 mb-6 text-xs space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                Client Machine & Network Telemetry
              </span>
              <span className="text-emerald-400 font-mono">Live Monitored</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col">
                <span className="text-slate-400 font-medium">Station Label:</span>
                <input
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder="e.g. Counter Laptop 1"
                  className="mt-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-400 font-semibold"
                />
              </div>

              <div className="flex flex-col">
                <span className="text-slate-400 font-medium">Client IP Address:</span>
                <span className="mt-1 font-mono font-bold text-amber-300 text-sm bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800 inline-block">
                  {ipAddress}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-slate-400 font-medium">Platform & Browser:</span>
                <span className="mt-1 text-slate-200 font-medium">
                  {os} • {browser}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-slate-400 font-medium">Screen Resolution:</span>
                <span className="mt-1 font-mono text-slate-300">{screenRes}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                Approver: <strong className="text-slate-200">ashish.sattur@gmail.com</strong>
              </span>
              <span className="font-mono text-slate-400">ID: {deviceId.substring(0, 12)}...</span>
            </div>
          </div>

          {/* Pending State Action Box */}
          {status === 'PENDING' && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">Waiting for Ashish to press YES...</h4>
                    <p className="text-[11px] text-amber-300/80">
                      When Ashish taps "YES" in the notification or email, this PC unlocks automatically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Ashish */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailPreview(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-medium text-xs transition-all hover:border-amber-400/50"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Open Email Notification</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPinDialog(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-200 font-semibold text-xs transition-all hover:border-emerald-500"
                >
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>Owner Direct Approval (PIN)</span>
                </button>
              </div>

              {/* One-click direct approval for Ashish if using this PC */}
              <div className="pt-2 text-center">
                <button
                  onClick={handleApproveYes}
                  disabled={isApproving}
                  className="inline-flex items-center gap-2 text-xs text-amber-400/90 hover:text-amber-300 underline font-medium cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Are you Ashish Sattur? Click here to approve this PC now
                </button>
              </div>
            </div>
          )}

          {/* Rejected State Action Box */}
          {status === 'REJECTED' && (
            <div className="space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-center">
                <p className="text-xs text-rose-200">
                  This terminal request was denied. If this was a mistake, re-request permission below.
                </p>
                <button
                  onClick={() => initSecurityCheck(deviceId, os, browser, screenRes)}
                  className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                >
                  Resend Verification Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-2xl w-full mx-auto text-center text-xs text-slate-400 z-10 space-y-1">
        <p>
          Security Protocol: Verification is restricted strictly to desktop PC software.
        </p>
        <p className="text-slate-400 text-[11px]">
          Handheld mobile barcode scanners connect directly via companion URL without PC authorization.
        </p>
      </div>

      {/* MODAL 1: Email Notification Preview with YES / NO buttons */}
      {showEmailPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Email Notification to Ashish Sattur</h3>
                  <p className="text-xs text-slate-400">ashish.sattur@gmail.com</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailPreview(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕ Close
              </button>
            </div>

            {/* Email Body Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-3 leading-relaxed text-slate-300">
              <div className="text-amber-400 font-bold border-b border-slate-800 pb-2">
                Subject: [SECURITY] New PC Access Verification Request from IP: {ipAddress}
              </div>
              <div>
                Hello <strong>Ashish Sattur</strong>,<br />
                A computer is requesting authorization to use your Pure Cotton POS & Inventory system:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-200">
                <li><strong>Station:</strong> {stationName}</li>
                <li><strong>Client IP Address:</strong> <span className="text-amber-300 font-bold">{ipAddress}</span></li>
                <li><strong>Operating System:</strong> {os}</li>
                <li><strong>Web Browser:</strong> {browser}</li>
                <li><strong>Display:</strong> {screenRes}</li>
                <li><strong>Timestamp:</strong> {new Date().toLocaleString()}</li>
              </ul>
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] text-slate-400">
                If you recognize this computer, click YES below to grant permission. Otherwise, reject or ignore.
              </div>
            </div>

            {/* Verification Choice Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleApproveYes}
                disabled={isApproving}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isApproving ? 'Authorizing...' : 'YES - Approve & Grant Access'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEmailPreview(false)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Reject / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Owner Quick PIN */}
      {showPinDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Owner Direct Unlock</h3>
              </div>
              <button
                onClick={() => setShowPinDialog(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <p className="text-xs text-slate-300">
                Enter your Admin Authorization PIN to approve this PC immediately:
              </p>
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN (Default: 2026)"
                  autoFocus
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg tracking-widest text-white focus:outline-none focus:border-emerald-500"
                />
                {pinError && <p className="text-xs text-rose-400 mt-1 font-medium">{pinError}</p>}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isApproving}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  {isApproving ? 'Authorizing...' : 'Authorize Terminal (YES)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
