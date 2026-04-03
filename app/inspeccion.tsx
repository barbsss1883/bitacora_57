import jornadaEmitter from 'path-to-jornadaEmitter';

// existing code

// Change interval timing
const interval = 2000; // Changed from 30000ms to 2000ms

useEffect(() => {
    const sincronizarBDEnVivo = () => {
        // existing sincronizarBDEnVivo logic
    };

    // other useEffect logic...

}, [/* dependencies */]);

useEffect(() => {
    const handleEstadoCambio = () => {
        sincronizarBDEnVivo();
    };

    jornadaEmitter.on('ESTADO_CAMBIO', handleEstadoCambio);

    return () => {
        jornadaEmitter.off('ESTADO_CAMBIO', handleEstadoCambio);
    };
}, []);