import React from 'react'
import { PanelRightOpen, PanelLeftOpen, FilePlus, File, FolderOpen, Save, RefreshCw, ScanEye, Scan, Eye, EyeOff, Sun, Moon, Languages, Globe } from 'lucide-react'
import { useI18n } from '../i18n'

interface ToolbarProps {
  isLight: boolean
  onToggleTheme: () => void
  onNew: () => void
  onOpenFiles: () => void
  onOpenDirectory: () => void
  onSave: () => void
  onRefresh: () => void
  hasChanges: boolean
  canRefresh: boolean
  showFileList: boolean
  onToggleFileList: () => void
  showEditor: boolean
  onToggleEditor: () => void
  showPreview: boolean
  onTogglePreview: () => void
}

export default function Toolbar({ isLight, onToggleTheme, onNew, onOpenFiles, onOpenDirectory, onSave, onRefresh, hasChanges, canRefresh, showFileList, onToggleFileList, showEditor, onToggleEditor, showPreview, onTogglePreview }: ToolbarProps) {
  const { t, locale, toggleLocale } = useI18n()

  return (
    <div className="toolbar">
      <button className="tool-btn" onClick={onToggleFileList} title={t(showFileList ? 'toolbar.hideFileList' : 'toolbar.showFileList')}>
        {showFileList ? <PanelRightOpen size={18} /> : <PanelLeftOpen size={18} />}
      </button>
      <div className="toolbar-separator" />
      <button className="tool-btn" onClick={onNew} title={t('toolbar.new')}>
        <File size={18} />
      </button>
      <button className="tool-btn" onClick={onOpenFiles} title={t('toolbar.openFile')}>
        <FilePlus size={18} />
      </button>
      <button className="tool-btn" onClick={onOpenDirectory} title={t('toolbar.openDirectory')}>
        <FolderOpen size={18} />
      </button>
      <button className="tool-btn" onClick={onSave} title={t('toolbar.save')} disabled={!hasChanges}>
        <Save size={18} />
      </button>
      <button className="tool-btn" onClick={onRefresh} title={t('toolbar.refresh')} disabled={!canRefresh}>
        <RefreshCw size={18} />
      </button>
      <div className="toolbar-separator" />
      <button className="tool-btn" onClick={onToggleEditor} title={t(showEditor ? 'toolbar.hideEditor' : 'toolbar.showEditor')}>
        {showEditor ? <Scan size={18} /> : <ScanEye size={18} />}
      </button>
      <button className="tool-btn" onClick={onTogglePreview} title={t(showPreview ? 'toolbar.hidePreview' : 'toolbar.showPreview')}>
        {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <div className="toolbar-spacer" />
      <button className="tool-btn" onClick={onToggleTheme} title={t('toolbar.theme')}>
        {isLight ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <button className="tool-btn" onClick={toggleLocale} title={t('toolbar.language')}>
        {locale === 'zh-CN' ? <Languages size={18} /> : <Globe size={18} />}
      </button>
    </div>
  )
}
