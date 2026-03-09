-- Tabla de Habitaciones
CREATE TABLE habitaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL,
    capacidad INTEGER NOT NULL,
    imagen_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Reservas (Pre-reservas)
CREATE TABLE reservas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habitacion_id UUID REFERENCES habitaciones(id),
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    nombre_huesped TEXT NOT NULL,
    email TEXT NOT NULL,
    telefono TEXT NOT NULL,
    cantidad_personas INTEGER NOT NULL DEFAULT 1,
    estado TEXT DEFAULT 'pendiente', -- pendiente, confirmada, cancelada
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Check simple para evitar fechas invertidas
    CONSTRAINT check_fechas CHECK (fecha_salida > fecha_entrada)
);

-- Índices para mejorar las consultas de disponibilidad y gestión
CREATE INDEX idx_reservas_fechas ON reservas (fecha_entrada, fecha_salida);
CREATE INDEX idx_reservas_habitacion ON reservas (habitacion_id);

-- Configuración de Row Level Security (RLS)
ALTER TABLE habitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Políticas para Habitaciones
CREATE POLICY "Habitaciones legibles públicamente" ON habitaciones
    FOR SELECT USING (true);

-- Políticas para Reservas
CREATE POLICY "Permitir inserción pública de reservas" ON reservas
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Solo lectura autenticada para el dueño" ON reservas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo actualización autenticada para el dueño" ON reservas
    FOR UPDATE TO authenticated USING (true);
