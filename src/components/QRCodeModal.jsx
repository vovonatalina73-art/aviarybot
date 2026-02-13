import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';
import { X, CheckCircle, Loader2 } from 'lucide-react';

const socket = io('http://localhost:3001');

const QRCodeModal = ({ isOpen, onClose }) => {
    const [qrCode, setQrCode] = useState('');
    const [status, setStatus] = useState('waiting'); // waiting, ready, authenticated

    useEffect(() => {
        if (!isOpen) return;

        socket.on('qr', (qr) => {
            setQrCode(qr);
            setStatus('waiting');
        });

        socket.on('ready', () => {
            setStatus('ready');
        });

        socket.on('authenticated', () => {
            setStatus('authenticated');
        });

        return () => {
            socket.off('qr');
            socket.off('ready');
            socket.off('authenticated');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Conectar WhatsApp</h2>
                    <p className="text-gray-500 mb-6">Escaneie o QR Code com seu celular para conectar o bot.</p>

                    <div className="flex justify-center mb-6">
                        {status === 'authenticated' || status === 'ready' ? (
                            <div className="flex flex-col items-center text-green-500 animate-in fade-in duration-500">
                                <CheckCircle size={64} className="mb-4" />
                                <span className="font-semibold text-lg">Conectado com Sucesso!</span>
                            </div>
                        ) : qrCode ? (
                            <div className="p-4 bg-white rounded-lg shadow-inner border border-gray-100">
                                <QRCodeSVG value={qrCode} size={256} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-gray-400 py-12">
                                <Loader2 size={48} className="animate-spin mb-4" />
                                <span>Gerando QR Code...</span>
                            </div>
                        )}
                    </div>

                    <div className="text-sm text-gray-400">
                        {status === 'waiting' && 'Aguardando leitura...'}
                        {status === 'authenticated' && 'Autenticado! Pode fechar esta janela.'}
                        {status === 'ready' && 'Bot pronto para uso!'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QRCodeModal;
