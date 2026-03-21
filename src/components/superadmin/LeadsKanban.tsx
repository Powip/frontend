import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { LeadCard } from './LeadCard';
import { leadService } from '@/services/leadService';
import { toast } from 'sonner';
import { Plus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLAN_MRR: Record<string, number> = {
  basic: 299,
  standard: 499,
  full: 799,
  enterprise: 1299,
};

const STAGES = [
  {
    id: 'nuevo',
    title: 'Nuevo Lead',
    color: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/20',
    showPotential: false,
  },
  {
    id: 'contactado',
    title: 'Contactado',
    color: 'text-cyan-400',
    accentBg: 'bg-cyan-500/10',
    accentBorder: 'border-cyan-500/20',
    showPotential: false,
  },
  {
    id: 'demo_agendada',
    title: 'Demo Agendada',
    color: 'text-purple-400',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/20',
    showPotential: true,
  },
  {
    id: 'demo_realizada',
    title: 'Demo Realizada',
    color: 'text-indigo-400',
    accentBg: 'bg-indigo-500/10',
    accentBorder: 'border-indigo-500/20',
    showPotential: true,
  },
  {
    id: 'evaluacion',
    title: 'Evaluación',
    color: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/20',
    showPotential: true,
  },
  {
    id: 'cerrado',
    title: 'Cerrado ✓',
    color: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/20',
    showPotential: false,
    showMrr: true,
  },
  {
    id: 'perdido',
    title: 'Perdido',
    color: 'text-rose-400',
    accentBg: 'bg-rose-500/10',
    accentBorder: 'border-rose-500/20',
    showPotential: false,
  },
];

interface LeadsKanbanProps {
  initialLeads: any[];
  token?: string;
}

export const LeadsKanban: React.FC<LeadsKanbanProps> = ({ initialLeads, token }) => {
  const [leads, setLeads] = useState(initialLeads);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadId = draggableId;
    const newStage = destination.droppableId;
    const oldStage = source.droppableId;

    // Optimistic update
    const updatedLeads = [...leads];
    const leadIndex = updatedLeads.findIndex(l => l.id === leadId);
    if (leadIndex === -1) return;

    const updatedLead = { ...updatedLeads[leadIndex], pipeline_stage: newStage, updated_at: new Date().toISOString() };
    updatedLeads[leadIndex] = updatedLead;
    setLeads(updatedLeads);

    try {
      await leadService.updateLeadStage(leadId, newStage, oldStage, token);
      toast.success('Etapa actualizada correctamente');
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Error al actualizar la etapa');
      setLeads(initialLeads);
    }
  };

  const getLeadsInStage = (stageId: string) =>
    leads.filter(lead => (lead.pipeline_stage || 'nuevo') === stageId);

  const getPotentialMrr = (stageLeads: any[]) =>
    stageLeads.reduce((acc, l) => acc + (PLAN_MRR[l.plan_interest?.toLowerCase()] || 0), 0);

  return (
    <div className="overflow-x-auto pb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 min-w-max px-1 py-2">
          {STAGES.map((stage) => {
            const stageLeads = getLeadsInStage(stage.id);
            const potential = getPotentialMrr(stageLeads);

            return (
              <div key={stage.id} className="w-[230px] flex flex-col group/col shrink-0">
                {/* Column header */}
                <div className={cn(
                  "mb-3 px-3 py-2.5 rounded-xl border transition-all",
                  "bg-white dark:bg-[#1a1f2e]",
                  stage.accentBorder,
                  "shadow-sm group-hover/col:shadow-md"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", stage.color)}>
                      {stage.title}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity">
                      <button className="p-0.5 hover:bg-white/10 rounded text-gray-500 transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button className="p-0.5 hover:bg-white/10 rounded text-gray-500 transition-colors">
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {stageLeads.length}
                    </span>
                    {(stage.showPotential || stage.showMrr) && potential > 0 && (
                      <span className={cn("text-[10px] font-bold", stage.color)}>
                        S/ {potential.toLocaleString()} {stage.showMrr ? 'MRR' : 'pot.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "flex-1 min-h-[500px] rounded-xl transition-all duration-200 p-1",
                        snapshot.isDraggingOver
                          ? cn("border-2", stage.accentBorder, stage.accentBg)
                          : "border-2 border-transparent"
                      )}
                    >
                      {stageLeads.length > 0 ? (
                        stageLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "transition-all duration-150",
                                  snapshot.isDragging && "scale-[1.03] rotate-1 z-50 shadow-2xl opacity-90"
                                )}
                              >
                                <LeadCard lead={lead} />
                              </div>
                            )}
                          </Draggable>
                        ))
                      ) : (
                        <div className={cn(
                          "h-[120px] flex items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-200 mt-1",
                          snapshot.isDraggingOver
                            ? cn(stage.accentBorder)
                            : "border-slate-200 dark:border-white/5"
                        )}>
                          <div className="text-center">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1.5",
                              "bg-slate-50 dark:bg-white/5 transition-all duration-200",
                              snapshot.isDraggingOver && cn(stage.accentBg)
                            )}>
                              <Plus className={cn("h-3.5 w-3.5", snapshot.isDraggingOver ? stage.color : "text-slate-400 dark:text-gray-600")} />
                            </div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-600">
                              Vacío
                            </p>
                          </div>
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};
