import { EventEmitter } from 'events';

class JornadaStateEmitter extends EventEmitter {
  private static instance: JornadaStateEmitter;

  private constructor() {
    super();
    // Aumentamos el límite por si abres varias pantallas de inspección
    this.setMaxListeners(20);
  }

  static getInstance(): JornadaStateEmitter {
    if (!JornadaStateEmitter.instance) {
      JornadaStateEmitter.instance = new JornadaStateEmitter();
    }
    return JornadaStateEmitter.instance;
  }

  // Emitir cambios de estado de la jornada (FS, COND, DESC, SERV)
  emitirCambioEstado(estado: 'FS' | 'COND' | 'DESC' | 'SERV') {
    this.emit('ESTADO_CAMBIO', estado);
  }

  // Escuchar cambios de estado (Devuelve función de limpieza)
  onEstadoCambio(callback: (estado: string) => void) {
    this.on('ESTADO_CAMBIO', callback);
    return () => this.removeListener('ESTADO_CAMBIO', callback);
  }

  // Emitir cuando se inicia pausa
  emitirPausaInicio(motivo: string) {
    this.emit('PAUSA_INICIO', motivo);
  }

  // Emitir cuando finaliza pausa
  emitirPausaFin() {
    this.emit('PAUSA_FIN');
  }

  // Emitir cuando finaliza jornada
  emitirJornadaFinalizada() {
    this.emit('JORNADA_FINALIZADA');
  }
}

// Exportamos la instancia única (Singleton)
export default JornadaStateEmitter.getInstance();
