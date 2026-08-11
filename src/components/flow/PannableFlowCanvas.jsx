import ReactFlow, { Background, Controls, MiniMap } from 'reactflow'
import 'reactflow/dist/style.css'

// Gedeelde 'Miro-achtige' canvasconfiguratie (pan/zoom/knoppen) voor elk
// sleepbaar React Flow-overzicht in de app (netwerkweergave, teampagina,
// ketenoverzicht). De aanroeper blijft eigenaar van de omringende div,
// hoogte, tooltips en zij-panelen — dit component is puur de `<ReactFlow>`
// zelf met de vaste navigatie-instellingen.
export default function PannableFlowCanvas({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onConnect,
  isValidConnection,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseMove,
  onNodeMouseLeave,
  onEdgeClick,
  onEdgeMouseEnter,
  onEdgeMouseMove,
  onEdgeMouseLeave,
  backgroundColor = '#e2e8f0',
  showMinimap = false,
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseMove={onNodeMouseMove}
      onNodeMouseLeave={onNodeMouseLeave}
      onEdgeClick={onEdgeClick}
      onEdgeMouseEnter={onEdgeMouseEnter}
      onEdgeMouseMove={onEdgeMouseMove}
      onEdgeMouseLeave={onEdgeMouseLeave}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesConnectable
      nodesDraggable
      elementsSelectable
      panOnDrag
      zoomOnScroll
      zoomOnPinch
    >
      <Background color={backgroundColor} gap={24} />
      <Controls showInteractive={false} />
      {showMinimap && (
        <MiniMap
          pannable
          zoomable
          nodeColor="#2a5f8a33"
          maskColor="rgba(226,232,240,0.6)"
          style={{ border: '1px solid #e2e8f0', borderRadius: 10 }}
        />
      )}
    </ReactFlow>
  )
}
