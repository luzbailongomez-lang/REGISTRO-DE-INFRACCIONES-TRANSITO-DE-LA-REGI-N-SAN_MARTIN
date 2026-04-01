import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Upload, FileText, MapPin, Calendar, AlertCircle, 
  BarChart3, PieChart as PieChartIcon, Activity, Filter, X,
  Info, Search, ChevronRight, Download, RefreshCcw, Map as MapIcon,
  AlertTriangle, CheckCircle2, Database
} from 'lucide-react';
import { cn } from './lib/utils';
import { TrafficInfraction } from './types';
import { Tooltip as ReactTooltip } from 'react-tooltip';

import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker,
  ZoomableGroup
} from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';

const PERU_GEO_URL = "https://raw.githubusercontent.com/dietmarz/geo-peru/master/peru_departamentos.json";

const COLORS = ['#5A5A40', '#7A7A5A', '#9A9A7A', '#BABA9A', '#DADAAB', '#4D4D35', '#3D3D2A', '#2D2D1F'];

export default function App() {
  const [data, setData] = useState<TrafficInfraction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    province: 'All',
    infractionType: 'All',
    search: '',
  });

  // Robust CSV Parsing
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor, sube un archivo en formato CSV.');
      return;
    }

    setIsLoading(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim().toUpperCase(),
      complete: (results) => {
        const parsedData = results.data as TrafficInfraction[];
        
        if (parsedData.length === 0) {
          setError('El archivo CSV no contiene registros válidos.');
          setIsLoading(false);
          return;
        }
        
        // Basic schema validation
        const requiredFields = ['ID_REGISTRO', 'FECHA', 'PROVINCIA', 'D_INFRACCION'];
        const headers = Object.keys(parsedData[0]);
        const missingFields = requiredFields.filter(f => !headers.includes(f));
        
        if (missingFields.length > 0) {
          setError(`El archivo no tiene el formato esperado. Faltan columnas: ${missingFields.join(', ')}`);
          setIsLoading(false);
          return;
        }

        // Data cleaning and normalization
        const cleanedData = parsedData.filter(item => item.ID_REGISTRO && item.FECHA).map(item => ({
          ...item,
          PROVINCIA: (item.PROVINCIA || 'DESCONOCIDO').trim().toUpperCase(),
          D_INFRACCION: (item.D_INFRACCION || 'SIN DESCRIPCIÓN').trim(),
          FECHA: item.FECHA.split(' ')[0], // Normalize date if it has time
        }));

        setData(cleanedData);
        setIsLoading(false);
      },
      error: (error) => {
        setError(`Error crítico al leer el archivo: ${error.message}`);
        setIsLoading(false);
      }
    });
  }, []);

  const resetFilters = () => {
    setFilters({
      province: 'All',
      infractionType: 'All',
      search: '',
    });
  };

  const exportData = () => {
    if (filteredData.length === 0) return;
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_infracciones_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchProvince = filters.province === 'All' || item.PROVINCIA === filters.province;
      const matchType = filters.infractionType === 'All' || item.D_INFRACCION === filters.infractionType;
      const matchSearch = !filters.search || 
        (item.ID_REGISTRO?.toLowerCase().includes(filters.search.toLowerCase())) ||
        (item.D_INFRACCION?.toLowerCase().includes(filters.search.toLowerCase())) ||
        (item.PROVINCIA?.toLowerCase().includes(filters.search.toLowerCase()));
      return matchProvince && matchType && matchSearch;
    });
  }, [data, filters]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const provinces = filteredData.reduce((acc, item) => {
      acc[item.PROVINCIA] = (acc[item.PROVINCIA] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const types = filteredData.reduce((acc, item) => {
      acc[item.D_INFRACCION] = (acc[item.D_INFRACCION] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topProvince = (Object.entries(provinces) as [string, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topType = (Object.entries(types) as [string, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      total: filteredData.length,
      uniqueInfractors: new Set(filteredData.map(i => i.ID_PERSONA_DNI)).size,
      topProvince,
      topType
    };
  }, [filteredData]);

  const provinceData = useMemo(() => {
    const counts = filteredData.reduce((acc, item) => {
      acc[item.PROVINCIA] = (acc[item.PROVINCIA] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (Object.entries(counts) as [string, number][])
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredData]);

  const typeData = useMemo(() => {
    const counts = filteredData.reduce((acc, item) => {
      acc[item.D_INFRACCION] = (acc[item.D_INFRACCION] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (Object.entries(counts) as [string, number][])
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredData]);

  const timeData = useMemo(() => {
    const counts = filteredData.reduce((acc, item) => {
      const date = item.FECHA;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([date, count]) => ({
        date,
        count,
        timestamp: new Date(date).getTime()
      }))
      .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp)
      .slice(-30); 
  }, [filteredData]);

  const spatialHotspots = useMemo((): { lat: number, lng: number, count: number, province: string }[] => {
    const hotspots = filteredData
      .filter(item => item.LATITUD && item.LONGITUD)
      .reduce((acc, item) => {
        const lat = parseFloat(item.LATITUD).toFixed(2);
        const lng = parseFloat(item.LONGITUD).toFixed(2);
        const key = `${lat},${lng}`;
        if (!acc[key]) {
          acc[key] = { lat: parseFloat(lat), lng: parseFloat(lng), count: 0, province: item.PROVINCIA };
        }
        acc[key].count += 1;
        return acc;
      }, {} as Record<string, { lat: number, lng: number, count: number, province: string }>);

    return (Object.values(hotspots) as { lat: number, lng: number, count: number, province: string }[])
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  const maxCount = useMemo(() => {
    const counts = spatialHotspots.map(h => h.count);
    return counts.length > 0 ? Math.max(...counts) : 1;
  }, [spatialHotspots]);

  const markerScale = scaleLinear().domain([1, maxCount]).range([2, 10]);

  const provincesList = useMemo(() => {
    return ['All', ...Array.from(new Set(data.map(i => i.PROVINCIA))).sort()];
  }, [data]);

  const typesList = useMemo(() => {
    return ['All', ...Array.from(new Set(data.map(i => i.D_INFRACCION))).sort()];
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-olive-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-olive-200 border-t-olive-600 rounded-full mb-6"
        />
        <h2 className="text-2xl font-black text-olive-900 mb-2">Procesando Datos</h2>
        <p className="text-olive-600 text-sm animate-pulse">Analizando registros de infracciones...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-olive-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full glass-card p-10">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-20 h-20 bg-olive-100 rounded-2xl flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-olive-600" />
            </div>
            <h1 className="text-3xl font-bold text-olive-900 mb-3">Dashboard de Infracciones</h1>
            <p className="text-olive-600 max-w-sm">
              Sube tu archivo CSV de infracciones de tránsito de la región San Martín para comenzar el análisis.
            </p>
          </div>

          <label className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-olive-200 rounded-[2rem] cursor-pointer hover:border-olive-400 hover:bg-olive-100/50 transition-all duration-300">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="p-4 bg-olive-50 rounded-full group-hover:bg-olive-100 transition-colors mb-4">
                <FileText className="w-8 h-8 text-olive-400 group-hover:text-olive-600" />
              </div>
              <p className="mb-2 text-sm text-olive-700">
                <span className="font-semibold text-olive-600">Haz clic para subir</span> o arrastra y suelta
              </p>
              <p className="text-xs text-olive-400">CSV (Max. 50MB)</p>
            </div>
            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
          </label>

          {error && (
            <div className="mt-6 p-4 bg-red-50 rounded-2xl flex items-start gap-3 border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-olive-50 border border-olive-100">
              <h3 className="text-xs font-bold text-olive-600 uppercase tracking-wider mb-2">Campos Requeridos</h3>
              <ul className="text-xs text-olive-500 space-y-1">
                <li>• ID_REGISTRO</li>
                <li>• FECHA</li>
                <li>• PROVINCIA</li>
                <li>• D_INFRACCION</li>
              </ul>
            </div>
            <div className="p-4 rounded-2xl bg-olive-50 border border-olive-100">
              <h3 className="text-xs font-bold text-olive-600 uppercase tracking-wider mb-2">Análisis Espacial</h3>
              <p className="text-xs text-olive-500">
                Incluye LATITUD y LONGITUD para visualizar la distribución geográfica.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-olive-50 text-olive-900 font-sans selection:bg-olive-200">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-olive-100 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-olive-600 rounded-xl flex items-center justify-center text-white">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-olive-900">Tránsito San Martín</h1>
              <p className="text-xs text-olive-600 font-medium uppercase tracking-widest opacity-70">Dashboard de Análisis</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-olive-400" />
              <input 
                type="text"
                placeholder="Buscar acta, infracción..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="bg-olive-50 border border-olive-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-olive-400 w-64 transition-all"
              />
            </div>
            <button 
              onClick={exportData}
              className="px-4 py-2 bg-olive-600 hover:bg-olive-700 text-white rounded-xl transition-all flex items-center gap-2 font-bold text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <div className="h-8 w-px bg-olive-200 mx-1" />
            <button 
              onClick={() => setData([])}
              className="px-4 py-2 text-sm font-semibold text-olive-600 hover:bg-olive-100 rounded-xl transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Cambiar CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Filters Bar */}
        <section className="glass-card p-4 rounded-2xl flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-olive-600">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wider">Filtros</span>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-olive-500 uppercase">Provincia</label>
            <select 
              value={filters.province}
              onChange={(e) => setFilters(prev => ({ ...prev, province: e.target.value }))}
              className="bg-olive-50 border border-olive-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-olive-400/50 outline-none min-w-[150px] text-olive-900"
            >
              {provincesList.map(p => <option key={p} value={p} className="bg-white">{p}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-olive-500 uppercase">Infracción</label>
            <select 
              value={filters.infractionType}
              onChange={(e) => setFilters(prev => ({ ...prev, infractionType: e.target.value }))}
              className="bg-olive-50 border border-olive-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-olive-400/50 outline-none max-w-[300px] text-olive-900"
            >
              {typesList.map(t => <option key={t} value={t} className="bg-white">{t}</option>)}
            </select>
          </div>

          {(filters.province !== 'All' || filters.infractionType !== 'All') && (
            <button 
              onClick={() => setFilters({ province: 'All', infractionType: 'All', search: '' })}
              className="text-xs font-bold text-olive-600 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 flex items-center gap-5 group hover:border-olive-400/30 transition-all">
            <div className="w-14 h-14 bg-olive-600 rounded-2xl flex items-center justify-center text-white">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-olive-500 uppercase tracking-wider mb-1">Total Infracciones</p>
              <h3 className="text-2xl font-black text-olive-900">{stats?.total.toLocaleString()}</h3>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-5 group hover:border-olive-400/30 transition-all">
            <div className="w-14 h-14 bg-olive-500 rounded-2xl flex items-center justify-center text-white">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-olive-500 uppercase tracking-wider mb-1">Infractores Únicos</p>
              <h3 className="text-2xl font-black text-olive-900">{stats?.uniqueInfractors.toLocaleString()}</h3>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-5 group hover:border-olive-400/30 transition-all">
            <div className="w-14 h-14 bg-olive-400 rounded-2xl flex items-center justify-center text-white">
              <MapPin className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-olive-500 uppercase tracking-wider mb-1">Provincia Crítica</p>
              <h3 className="text-lg font-black truncate max-w-[180px] text-olive-900">{stats?.topProvince}</h3>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-5 group hover:border-olive-400/30 transition-all">
            <div className="w-14 h-14 bg-olive-300 rounded-2xl flex items-center justify-center text-white">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-olive-500 uppercase tracking-wider mb-1">Infracción Común</p>
              <h3 className="text-lg font-black truncate max-w-[180px] text-olive-900">{stats?.topType}</h3>
            </div>
          </div>
        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Bar Chart */}
          <div className="lg:col-span-2 glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-olive-900">
                  <BarChart3 className="w-5 h-5 text-olive-600" />
                  Infracciones por Provincia
                </h3>
                <p className="text-xs text-olive-500 font-medium">Top 10 provincias con más registros</p>
              </div>
            </div>
            <div className="h-[400px] w-full flex items-center justify-center">
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provinceData} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(90,90,64,0.1)" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 600, fill: '#5A5A40' }}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(90,90,64,0.05)' }}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #DADAAB', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      itemStyle={{ color: '#2D2D1F' }}
                    />
                    <Bar dataKey="value" fill="#5A5A40" radius={[0, 8, 8, 0]} barSize={24}>
                      {provinceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <Database className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No hay datos para mostrar</p>
                </div>
              )}
            </div>
          </div>

          {/* Pie Chart */}
          <div className="glass-card p-8">
            <div className="mb-8">
              <h3 className="text-lg font-bold flex items-center gap-2 text-olive-900">
                <PieChartIcon className="w-5 h-5 text-olive-600" />
                Tipos de Infracción
              </h3>
              <p className="text-xs text-olive-500 font-medium">Distribución de las infracciones más frecuentes</p>
            </div>
            <div className="h-[300px] w-full flex items-center justify-center">
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #DADAAB', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      itemStyle={{ color: '#2D2D1F' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <Database className="w-12 h-12 text-olive-200 mx-auto mb-4" />
                  <p className="text-olive-400 text-sm">No hay datos para mostrar</p>
                </div>
              )}
            </div>
            <div className="mt-6 space-y-2">
              {typeData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-[200px]">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="font-semibold text-olive-500 truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-olive-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Line Chart - Trend */}
          <div className="lg:col-span-3 glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-olive-900">
                  <Calendar className="w-5 h-5 text-olive-600" />
                  Tendencia Temporal
                </h3>
                <p className="text-xs text-olive-500 font-medium">Histórico de infracciones diarias (Últimos 30 días registrados)</p>
              </div>
            </div>
            <div className="h-[300px] w-full flex items-center justify-center">
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(90,90,64,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#7A7A5A' }}
                      minTickGap={30}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#7A7A5A' }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #DADAAB', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      itemStyle={{ color: '#2D2D1F' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#5A5A40" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#5A5A40', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#5A5A40' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <Database className="w-12 h-12 text-olive-200 mx-auto mb-4" />
                  <p className="text-olive-400 text-sm">No hay datos para mostrar</p>
                </div>
              )}
            </div>
          </div>

          {/* Mapa de Infracciones */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-3 glass-card p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-olive-900">
                  <MapPin className="w-5 h-5 text-olive-600" />
                  Mapa de Puntos Críticos (San Martín)
                </h3>
                <p className="text-xs text-olive-500 font-medium">Visualización espacial de infracciones en la región</p>
              </div>
              <div className="text-[10px] font-bold text-olive-600 bg-olive-100 px-3 py-1 rounded-full border border-olive-200">
                {spatialHotspots.length} Hotspots detectados
              </div>
            </div>
            <div className="h-[600px] w-full bg-olive-50 rounded-2xl relative overflow-hidden border border-olive-100">
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                  scale: 4000,
                  center: [-77, -7] // Centrado en San Martín, Perú
                }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <ZoomableGroup center={[-77, -7]} zoom={1}>
                  <Geographies geography={PERU_GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const isSanMartin = geo.properties.NOMBDEP === "SAN MARTIN";
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isSanMartin ? "rgba(90, 90, 64, 0.1)" : "rgba(90, 90, 64, 0.02)"}
                            stroke={isSanMartin ? "#5A5A40" : "rgba(90, 90, 64, 0.1)"}
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { fill: isSanMartin ? "rgba(90, 90, 64, 0.2)" : "rgba(90, 90, 64, 0.05)", outline: "none" },
                              pressed: { outline: "none" },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                  {spatialHotspots.map((hotspot: { lat: number, lng: number, count: number, province: string }, index: number) => (
                    <Marker key={index} coordinates={[hotspot.lng, hotspot.lat]}>
                      <circle
                        r={markerScale(hotspot.count)}
                        fill="#5A5A40"
                        stroke="#fff"
                        strokeWidth={0.5}
                        className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ filter: `drop-shadow(0 0 5px rgba(90, 90, 64, 0.4))` }}
                        data-tooltip-id="map-tooltip"
                        data-tooltip-content={`${hotspot.province}: ${hotspot.count} infracciones`}
                      />
                      {hotspot.count > maxCount * 0.3 && (
                        <circle
                          r={markerScale(hotspot.count) * 2.5}
                          fill="#5A5A40"
                          className="animate-ping opacity-20"
                        />
                      )}
                    </Marker>
                  ))}
                </ZoomableGroup>
              </ComposableMap>
              
              {/* Leyenda del Mapa */}
              <div className="absolute bottom-6 left-6 glass-card p-4 border border-olive-100 text-[10px] space-y-3 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-olive-100 border border-olive-400 rounded-sm"></div>
                  <span className="text-olive-700 font-semibold">Región San Martín</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-olive-600 rounded-full"></div>
                  <span className="text-olive-700 font-semibold">Punto de Infracción</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-olive-600 rounded-full animate-ping opacity-50"></div>
                  <span className="text-olive-700 font-semibold">Zona de Alta Incidencia</span>
                </div>
                <div className="pt-2 border-t border-olive-100 text-[9px] text-olive-400 italic">
                  * Tamaño del punto proporcional al volumen
                </div>
              </div>

              {/* Botón de Ayuda Zoom */}
              <div className="absolute top-6 right-6 flex flex-col gap-2">
                <div className="glass-card p-2 rounded-lg border border-white/10 text-white/50 hover:text-white transition-colors cursor-help group relative">
                  <Info className="w-4 h-4" />
                  <div className="absolute right-full mr-2 top-0 glass-card p-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-[10px] pointer-events-none">
                    Usa el scroll para hacer zoom
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Data Table Preview */}
        <section className="glass-card overflow-hidden">
          <div className="p-6 border-b border-olive-100 flex items-center justify-between">
            <h3 className="font-bold text-olive-900">Vista Previa de Datos</h3>
            <span className="text-xs text-olive-500 font-medium">Mostrando registros filtrados</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-olive-50 text-olive-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Provincia</th>
                  <th className="px-6 py-4">Distrito</th>
                  <th className="px-6 py-4">Infracción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-100">
                {filteredData.slice(0, 10).map((item) => (
                  <tr key={item.ID_REGISTRO} className="hover:bg-olive-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-olive-600">{item.ID_REGISTRO}</td>
                    <td className="px-6 py-4 text-olive-500">{item.FECHA}</td>
                    <td className="px-6 py-4 font-semibold text-olive-800">{item.PROVINCIA}</td>
                    <td className="px-6 py-4 text-olive-500">{item.DISTRITO}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-olive-100 text-olive-700 border border-olive-200 rounded-md text-[10px] font-bold truncate max-w-[200px] inline-block">
                        {item.D_INFRACCION}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredData.length > 10 && (
            <div className="p-4 bg-olive-50 text-center">
              <p className="text-xs text-olive-400 font-medium">
                Y {filteredData.length - 10} registros más...
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-[1600px] mx-auto p-6 text-center">
        <p className="text-xs text-olive-400 font-medium">
          Dashboard de Análisis de Infracciones de Tránsito • San Martín, Perú • 2026
        </p>
      </footer>
      <ReactTooltip id="map-tooltip" className="!bg-white !backdrop-blur-md !border !border-olive-200 !rounded-xl !p-3 !text-xs !shadow-2xl !z-50 !text-olive-900" />
    </div>
  );
}
