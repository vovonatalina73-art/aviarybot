import React from 'react';
import { MessageSquare, Play, List, Clock, Image as ImageIcon, Video, Mic, FileText } from 'lucide-react';

const SidebarItem = ({ type, label, icon: Icon, color }) => {
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div
            className={`flex items-center gap-3 p-3 mb-3 bg-gray-900 border border-gray-700 rounded-lg cursor-grab hover:shadow-[0_0_10px_rgba(57,255,20,0.2)] transition-all hover:border-[#39ff14] group`}
            onDragStart={(event) => onDragStart(event, type)}
            draggable
        >
            <div className={`p-2 rounded-md ${color} text-white group-hover:scale-110 transition-transform`}>
                <Icon size={20} />
            </div>
            <span className="font-medium text-gray-300 group-hover:text-white transition-colors">{label}</span>
        </div>
    );
};

const Sidebar = () => {
    return (
        <aside className="w-80 h-full bg-[#0a0a0a] border-r border-gray-800 p-6 flex flex-col shadow-2xl z-20">
            <div className="mb-10 text-center flex flex-col items-center justify-center">
                <img src="/logo.png" alt="AviaryBot Logo" className="w-32 h-32 mb-4 object-contain drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]" />
                <h1 className="text-4xl font-bold text-white tracking-widest neon-text">
                    AVIARY<span className="text-[#39ff14]">BOT</span>
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="mb-6">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Fluxo</h3>

                    <SidebarItem type="start" label="Início" icon={Play} color="bg-green-600" />
                    <SidebarItem type="content" label="Mensagem" icon={MessageSquare} color="bg-rose-600" />
                    <SidebarItem type="menu" label="Menu" icon={List} color="bg-purple-600" />
                    <SidebarItem type="delay" label="Delay" icon={Clock} color="bg-yellow-600" />
                </div>

                <div className="mb-6">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 border-b border-gray-800 pb-2">Mídia</h3>

                    <SidebarItem type="image" label="Imagem" icon={ImageIcon} color="bg-blue-600" />
                    <SidebarItem type="video" label="Vídeo" icon={Video} color="bg-orange-600" />
                    <SidebarItem type="audio" label="Áudio" icon={Mic} color="bg-teal-600" />
                    <SidebarItem type="pdf" label="PDF" icon={FileText} color="bg-red-600" />
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-800 text-xs text-center text-gray-600">
                Arraste para o canvas
            </div>
        </aside>
    );
};

export default Sidebar;
