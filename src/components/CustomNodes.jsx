import React, { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { MessageSquare, Play, List, Plus, Trash2, Clock, Image as ImageIcon, Video, Mic, X, FileText } from 'lucide-react';

const NodeHeader = ({ color, icon: Icon, label, onDelete }) => (
    <div className={`flex items-center justify-between px-4 py-2 rounded-t-lg text-white font-medium ${color} bg-opacity-80 backdrop-blur-sm`}>
        <div className="flex items-center gap-2">
            <Icon size={16} />
            <span className="text-sm tracking-wide">{label}</span>
        </div>
        {onDelete && (
            <button
                onClick={onDelete}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                title="Excluir bloco"
            >
                <X size={14} />
            </button>
        )}
    </div>
);

const BaseNode = ({ id, children, color, icon, label, selected }) => {
    const { deleteElements } = useReactFlow();

    const handleDelete = () => {
        if (window.confirm('Tem certeza que deseja excluir este bloco?')) {
            deleteElements({ nodes: [{ id }] });
        }
    };

    return (
        <div className={`min-w-[250px] bg-gray-900 rounded-lg border ${selected ? 'border-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.3)]' : 'border-gray-700'} transition-all duration-300`}>
            <NodeHeader color={color} icon={icon} label={label} onDelete={handleDelete} />
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

export const StartNode = memo(({ id, data, selected }) => {
    return (
        <div className={`min-w-[200px] bg-gray-900 rounded-lg border ${selected ? 'border-[#39ff14]' : 'border-gray-700'} shadow-sm`}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-white font-medium bg-green-600 bg-opacity-80 backdrop-blur-sm`}>
                <Play size={16} />
                <span className="text-sm tracking-wide">Início</span>
            </div>
            <div className="p-4 text-sm text-gray-400">
                Ponto de partida do fluxo
            </div>
            <Handle type="source" position={Position.Right} className="!bg-[#39ff14]" />
        </div>
    );
});

export const ContentNode = memo(({ id, data, selected }) => {
    return (
        <BaseNode id={id} color="bg-rose-600" icon={MessageSquare} label="Mensagem de Texto" selected={selected}>
            <label className="block text-xs font-medium text-gray-500 mb-2">Mensagem</label>
            <textarea
                className="w-full text-sm p-3 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-rose-500 resize-none"
                rows={3}
                placeholder="Digite a mensagem..."
                defaultValue={data.label}
                onChange={(evt) => data.onChange?.(evt.target.value)}
            />
            <Handle type="target" position={Position.Left} className="!bg-gray-500" />
            <Handle type="source" position={Position.Right} className="!bg-rose-500" />
        </BaseNode>
    );
});

export const MenuNode = memo(({ id, data, selected }) => {
    const { setNodes } = useReactFlow();
    const [options, setOptions] = useState(data.options || []);

    const addOption = () => {
        const newOption = {
            id: `opt-${Date.now()}`,
            label: `Opção ${options.length + 1}`
        };
        const newOptions = [...options, newOption];
        setOptions(newOptions);

        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, options: newOptions } };
                }
                return node;
            })
        );
    };

    const removeOption = (optId) => {
        const newOptions = options.filter(opt => opt.id !== optId);
        setOptions(newOptions);

        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, options: newOptions } };
                }
                return node;
            })
        );
    };

    const updateOptionLabel = (optId, newLabel) => {
        const newOptions = options.map(opt =>
            opt.id === optId ? { ...opt, label: newLabel } : opt
        );
        setOptions(newOptions);

        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, options: newOptions } };
                }
                return node;
            })
        );
    };

    return (
        <BaseNode id={id} color="bg-purple-600" icon={List} label="Menu de Opções" selected={selected}>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                    <input
                        type="checkbox"
                        id={`poll-toggle-${id}`}
                        checked={data.usePoll === true}
                        onChange={(e) => {
                            setNodes((nodes) =>
                                nodes.map((node) => {
                                    if (node.id === id) {
                                        return { ...node, data: { ...node.data, usePoll: e.target.checked } };
                                    }
                                    return node;
                                })
                            );
                        }}
                        className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                    />
                    <label htmlFor={`poll-toggle-${id}`} className="text-xs text-gray-300 cursor-pointer select-none">
                        Usar Enquete (Clicável)
                    </label>
                </div>

                <div className="text-sm text-gray-400 mb-1">
                    Opções do menu:
                </div>

                {options.map((option) => (
                    <div key={option.id} className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={option.label}
                            onChange={(e) => updateOptionLabel(option.id, e.target.value)}
                            className="flex-1 text-sm p-2 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-purple-600"
                            placeholder="Nome da opção"
                        />
                        <button
                            onClick={() => removeOption(option.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>

                        <Handle
                            type="source"
                            position={Position.Right}
                            id={option.id}
                            className="!bg-purple-600 !-right-3"
                            style={{ top: '50%', transform: 'translateY(-50%)' }}
                        />
                    </div>
                ))}

                <button
                    onClick={addOption}
                    className="flex items-center justify-center gap-2 w-full py-2 mt-2 text-sm font-medium text-purple-400 bg-purple-900/20 hover:bg-purple-900/40 rounded-md transition-colors border border-purple-900/50"
                >
                    <Plus size={16} />
                    Adicionar Opção
                </button>
            </div>
            <Handle type="target" position={Position.Left} className="!bg-gray-500" />
        </BaseNode>
    );
});

export const DelayNode = memo(({ id, data, selected }) => {
    return (
        <BaseNode id={id} color="bg-yellow-600" icon={Clock} label="Aguardar (Delay)" selected={selected}>
            <label className="block text-xs font-medium text-gray-500 mb-2">Tempo em segundos</label>
            <input
                type="number"
                className="w-full text-sm p-2 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-yellow-500"
                placeholder="Ex: 5"
                defaultValue={data.delay || 5}
                onChange={(evt) => data.onChange?.(evt.target.value)}
            />
            <Handle type="target" position={Position.Left} className="!bg-gray-500" />
            <Handle type="source" position={Position.Right} className="!bg-yellow-500" />
        </BaseNode>
    );
});

const MediaNode = ({ id, data, selected, type, icon: Icon, color, accept, label }) => {
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                data.onMediaChange?.(reader.result, file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <BaseNode id={id} color={color} icon={Icon} label={label} selected={selected}>
            <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-gray-500">Arquivo</label>
                <input
                    type="file"
                    accept={accept}
                    onChange={handleFileChange}
                    className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700"
                />
                {data.fileName && (
                    <div className="text-xs text-green-400 mt-1 truncate">
                        Selecionado: {data.fileName}
                    </div>
                )}
            </div>
            <Handle type="target" position={Position.Left} className="!bg-gray-500" />
            <Handle type="source" position={Position.Right} className={`!${color.replace('bg-', 'bg-')}`} />
        </BaseNode>
    );
};

export const ImageNode = memo((props) => (
    <MediaNode {...props} type="image" icon={ImageIcon} color="bg-blue-600" accept="image/*" label="Enviar Imagem" />
));

export const VideoNode = memo((props) => (
    <MediaNode {...props} type="video" icon={Video} color="bg-orange-600" accept="video/*" label="Enviar Vídeo" />
));

export const AudioNode = memo((props) => (
    <MediaNode {...props} type="audio" icon={Mic} color="bg-teal-600" accept="audio/*" label="Enviar Áudio" />
));

export const PdfNode = memo((props) => (
    <MediaNode {...props} type="pdf" icon={FileText} color="bg-red-600" accept="application/pdf" label="Enviar PDF" />
));
