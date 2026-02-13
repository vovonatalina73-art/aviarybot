import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Smartphone, Trash2, Users, Layout, DollarSign } from 'lucide-react';

import Sidebar from './Sidebar';
import { StartNode, ContentNode, MenuNode, DelayNode, ImageNode, VideoNode, AudioNode, PdfNode } from './CustomNodes';
import DeletableEdge from './CustomEdges';
import QRCodeModal from './QRCodeModal';
import LeadsDashboard from './LeadsDashboard';
import FinancialDashboard from './FinancialDashboard';

const nodeTypes = {
    start: StartNode,
    content: ContentNode,
    menu: MenuNode,
    delay: DelayNode,
    image: ImageNode,
    video: VideoNode,
    audio: AudioNode,
    pdf: PdfNode,
};

const edgeTypes = {
    deletable: DeletableEdge,
};

const initialNodes = [
    {
        id: '1',
        type: 'start',
        position: { x: 250, y: 100 },
        data: { label: 'Início' },
    },
];

const getId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const FlowBuilderContent = () => {
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [view, setView] = useState('builder'); // 'builder' | 'leads' | 'financial'

    // Function to update node data
    const updateNodeData = useCallback((nodeId, newData) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return { ...node, data: { ...node.data, ...newData } };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Load flow on mount
    React.useEffect(() => {
        const fetchFlow = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/flow');
                const flow = await response.json();
                if (flow) {
                    // Re-attach handlers to loaded nodes
                    const loadedNodes = (flow.nodes || []).map(node => ({
                        ...node,
                        data: {
                            ...node.data,
                            onChange: (value) => updateNodeData(node.id, { label: value, delay: value }),
                            onMediaChange: (media, fileName) => updateNodeData(node.id, { media, fileName })
                        }
                    }));
                    setNodes(loadedNodes);

                    // Ensure loaded edges use the custom type
                    const loadedEdges = (flow.edges || []).map(edge => ({
                        ...edge,
                        type: 'deletable',
                        style: { stroke: '#39ff14', strokeWidth: 2 }
                    }));
                    setEdges(loadedEdges);
                }
            } catch (error) {
                console.error('Error fetching flow:', error);
            }
        };
        fetchFlow();
    }, [setNodes, setEdges, updateNodeData]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, type: 'deletable', animated: true, style: { stroke: '#39ff14', strokeWidth: 2 } }, eds)),
        [setEdges]
    );

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: getId(),
                type,
                position,
                data: {
                    label: `${type} node`,
                    // Pass handlers for data updates
                    onChange: (value) => updateNodeData(newNode.id, { label: value, delay: value }),
                    onMediaChange: (media, fileName) => updateNodeData(newNode.id, { media, fileName })
                },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    const onSave = useCallback(async () => {
        if (reactFlowInstance) {
            const flow = reactFlowInstance.toObject();
            console.log('Flow saved:', flow);

            try {
                const response = await fetch('http://localhost:3001/api/save-flow', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(flow),
                });

                const data = await response.json();
                if (data.success) {
                    alert('Fluxo salvo e atualizado no bot! 💾');
                } else {
                    alert('Erro ao salvar fluxo.');
                }
            } catch (error) {
                console.error('Error saving flow:', error);
                alert('Erro ao conectar com o servidor. Verifique se o backend está rodando.');
            }
        }
    }, [reactFlowInstance]);

    const onClear = useCallback(() => {
        if (window.confirm('Tem certeza que deseja limpar todo o fluxo?')) {
            setNodes(initialNodes);
            setEdges([]);
        }
    }, [setNodes, setEdges]);

    return (
        <div className="flex h-screen w-full bg-[#0a0a0a] text-white">
            {view === 'builder' && <Sidebar />}

            <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                <div className="absolute top-4 right-4 z-50 flex gap-3">
                    <button
                        onClick={() => setView(view === 'builder' ? 'leads' : 'builder')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium backdrop-blur-sm ${view === 'leads'
                            ? 'bg-purple-900/20 text-purple-400 border border-purple-900/50 hover:bg-purple-900/40'
                            : 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700'
                            }`}
                    >
                        {view === 'builder' ? <Users size={18} /> : <Layout size={18} />}
                        {view === 'builder' ? 'Leads' : 'Voltar ao Fluxo'}
                    </button>

                    <button
                        onClick={() => setView(view === 'financial' ? 'builder' : 'financial')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium backdrop-blur-sm ${view === 'financial'
                            ? 'bg-green-900/20 text-green-400 border border-green-900/50 hover:bg-green-900/40'
                            : 'bg-gray-800 text-white border border-gray-700 hover:bg-gray-700'
                            }`}
                    >
                        <DollarSign size={18} />
                        ROI
                    </button>

                    {view === 'builder' && (
                        <>
                            <button
                                onClick={onClear}
                                className="flex items-center gap-2 px-4 py-2 bg-red-900/20 text-red-500 border border-red-900/50 rounded-lg hover:bg-red-900/40 transition-all font-medium backdrop-blur-sm"
                                title="Limpar Fluxo"
                            >
                                <Trash2 size={18} />
                            </button>

                            <button
                                onClick={() => setIsQRModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-900/20 text-[#39ff14] border border-green-900/50 rounded-lg hover:bg-green-900/40 transition-all font-medium backdrop-blur-sm shadow-[0_0_10px_rgba(57,255,20,0.1)]"
                            >
                                <Smartphone size={18} />
                                <Smartphone size={18} />
                                Conectar WhatsApp
                            </button>

                            <button
                                onClick={onSave}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-900/20 text-blue-400 border border-blue-900/50 rounded-lg hover:bg-blue-900/40 transition-all font-medium backdrop-blur-sm"
                            >
                                <Save size={18} />
                                Salvar Fluxo
                            </button>
                        </>
                    )}
                </div>

                {view === 'builder' ? (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        className="bg-[#0a0a0a]"
                    >
                        <Background color="#222" gap={20} />
                        <Controls className="!bg-gray-900 !border-gray-800 !shadow-lg !text-gray-400" />
                        <MiniMap
                            className="!bg-gray-900 !border-gray-800 !shadow-lg"
                            maskColor="rgba(0, 0, 0, 0.7)"
                            nodeColor={(node) => {
                                switch (node.type) {
                                    case 'start': return '#16a34a';
                                    case 'content': return '#e11d48';
                                    case 'menu': return '#9333ea';
                                    case 'delay': return '#ca8a04';
                                    case 'image': return '#2563eb';
                                    case 'video': return '#ea580c';
                                    case 'audio': return '#0d9488';
                                    case 'pdf': return '#dc2626';
                                    default: return '#333';
                                }
                            }}
                        />
                    </ReactFlow>
                ) : view === 'leads' ? (
                    <LeadsDashboard />
                ) : (
                    <FinancialDashboard />
                )}

                <QRCodeModal
                    isOpen={isQRModalOpen}
                    onClose={() => setIsQRModalOpen(false)}
                />
            </div>
        </div>
    );
};

const FlowBuilder = () => {
    return (
        <ReactFlowProvider>
            <FlowBuilderContent />
        </ReactFlowProvider>
    );
};

export default FlowBuilder;
