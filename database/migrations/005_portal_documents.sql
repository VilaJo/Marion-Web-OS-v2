-- Portal Documents (contracts, invoices, quotes shared by Marion for client download)
CREATE TABLE IF NOT EXISTS portal_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    doc_type TEXT DEFAULT 'other' CHECK(doc_type IN ('contract', 'invoice', 'quote', 'report', 'other')),
    file_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT 1,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portal_documents_project ON portal_documents(project_id);
