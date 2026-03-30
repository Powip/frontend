'use client';

import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { leadService } from '@/services/leadService';
import { toast } from 'sonner';
import { 
  History, 
  MessageSquare, 
  Clock, 
  User, 
  ArrowRight,
  PlusCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadActivitiesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  token?: string;
}

export const LeadActivitiesDrawer: React.FC<LeadActivitiesDrawerProps> = ({
  isOpen,
  onClose,
  leadId,
  leadName,
  token,
}) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchActivities();
    }
  }, [isOpen, leadId]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await leadService.getLeadDetails(leadId, token);
      setActivities(data.activities || []);
    } catch (error) {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSubmitting(true);
    try {
      await leadService.addActivity(leadId, 'note', newNote, token);
      toast.success('Nota guardada');
      setNewNote('');
      fetchActivities();
    } catch (error) {
      toast.error('Error al guardar nota');
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stage_change': return <ArrowRight className="h-4 w-4 text-primary" />;
      case 'note': return <MessageSquare className="h-4 w-4 text-amber-500" />;
      case 'sync': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <History className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[450px] flex flex-col p-0 border-none shadow-2xl bg-white dark:bg-slate-900">
        <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <SheetTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historial de Actividad
          </SheetTitle>
          <SheetDescription className="text-slate-500 font-medium">
            Seguimiento para <span className="text-primary font-bold">{leadName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <PlusCircle className="h-3 w-3" /> Nueva Observación
            </label>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <Textarea 
                placeholder="Escribe una nota interna sobre este prospecto..."
                className="bg-transparent border-none focus-visible:ring-0 resize-none text-sm min-h-[80px]"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <div className="flex justify-end">
                <Button 
                  size="sm" 
                  disabled={submitting || !newNote.trim()}
                  onClick={handleAddNote}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl h-9 px-6 transition-all"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                  Guardar Nota
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Línea de Tiempo</label>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Cargando actividades...</p>
              </div>
            ) : activities.length > 0 ? (
              <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 dark:before:bg-slate-800">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-8 animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center z-10">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </div>
                    <div className="p-4 rounded-xl border border-slate-50 dark:border-slate-800/50 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-all duration-200 group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {getActivityIcon(activity.activity_type)}
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
                            {activity.activity_type === 'stage_change' ? 'Cambio de Estado' : 
                             activity.activity_type === 'note' ? 'Nota Interna' : 
                             activity.activity_type.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                          <Clock className="h-3 w-3" />
                          {new Date(activity.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {activity.description}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        <User className="h-2.5 w-2.5" />
                        {activity.performed_by || 'Sistema'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 grayscale opacity-30">
                <History className="h-12 w-12 text-slate-300" />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center">No hay actividad registrada aún</p>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="p-6 border-t border-slate-100 dark:border-slate-800">
          <Button onClick={onClose} variant="secondary" className="w-full text-[11px] font-black uppercase tracking-widest h-11">
            Cerrar Historial
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
