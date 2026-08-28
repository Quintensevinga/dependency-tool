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
  edgeTypes,
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
  onPaneClick,
  backgroundColor = '#e2e8f0',
  showMinimap = false,
  className,
  fitViewOptions = { padding: 0.2 },
  minZoom = 0.2,
  maxZoom = 2,
  hideControls = false,
  // De teampagina-canvas doet zijn eigen initiële fit (toolbar-bewust, zie
  // TeamCanvasToolbar in TeamPage.jsx) — deze generieke fit-op-mount zou
  // daarmee racen (wie het laatst zet, wint) en soms zonder toolbar-marge
  // winnen, met content onder de zwevende toolbar als gevolg.
  disableAutoFit = false,
}) {
  return (
    <ReactFlow
      className={className}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
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
      onPaneClick={onPaneClick}
      fitView={!disableAutoFit}
      fitViewOptions={fitViewOptions}
      // Herhaal de fit na de eerste render: op het allereerste frame heeft
      // ReactFlow de node-afmetingen soms nog niet volledig gemeten,
      // waardoor de eenmalige `fitView`-prop breder canvasinhoud (bv. de
      // Teamcanvas met meerdere lanes) net buiten beeld kan laten vallen.
      onInit={(instance) => {
        if (!disableAutoFit) window.requestAnimationFrame(() => instance.fitView(fitViewOptions))
      }}
      minZoom={minZoom}
      maxZoom={maxZoom}
      proOptions={{ hideAttribution: true }}
      nodesConnectable
      nodesDraggable
      elementsSelectable
      panOnDrag
      zoomOnScroll
      zoomOnPinch
    >
      <Background color={backgroundColor} gap={24} />
      {!hideControls && <Controls showInteractive={false} />}
      {showMinimap && (
        <MiniMap
          pannable
          zoomable
          nodeColor="#2a5f8a22"
          nodeStrokeColor="#2a5f8a50"
          nodeStrokeWidth={2}
          nodeBorderRadius={4}
          maskColor="rgba(42,95,138,0.06)"
        />
      )}
    </ReactFlow>
  )
}
