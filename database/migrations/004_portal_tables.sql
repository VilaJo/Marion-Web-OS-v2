-- Portal Deliverables (posted by Marion for clients to see)
CREATE TABLE IF NOT EXISTS portal_deliverables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'link' CHECK(type IN ('link', 'image', 'file', 'figma', 'website')),
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    thumbnail_base64 TEXT,
    sort_order INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Portal Updates (progress journal posted by Marion)
CREATE TABLE IF NOT EXISTS portal_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    phase TEXT,
    title TEXT NOT NULL,
    content TEXT,
    attachments_json TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Portal Client Files (uploaded by clients through the public portal)
CREATE TABLE IF NOT EXISTS portal_client_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER DEFAULT 0,
    category TEXT DEFAULT 'other' CHECK(category IN ('text', 'image', 'logo', 'document', 'other')),
    note TEXT,
    author_name TEXT,
    seen BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Portal Comments (stored in their own table instead of JSON)
CREATE TABLE IF NOT EXISTS portal_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    phase_ref TEXT,
    is_admin BOOLEAN DEFAULT 0,
    seen BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_deliverables_project ON portal_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_updates_project ON portal_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_client_files_project ON portal_client_files(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_comments_project ON portal_comments(project_id);
