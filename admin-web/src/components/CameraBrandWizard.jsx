import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography, Box, Grid, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Chip, IconButton, Stepper, Step, StepLabel,
  Switch, FormControlLabel, CircularProgress, InputAdornment,
  Radio, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from './GlassCard';
import AnimatedDialog from './AnimatedDialog';
import { monoFont } from '../theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNTRY_FLAGS = {
  CN: '\u{1F1E8}\u{1F1F3}', SE: '\u{1F1F8}\u{1F1EA}', DE: '\u{1F1E9}\u{1F1EA}',
  KR: '\u{1F1F0}\u{1F1F7}', US: '\u{1F1FA}\u{1F1F8}', CA: '\u{1F1E8}\u{1F1E6}',
  AU: '\u{1F1E6}\u{1F1FA}', TW: '\u{1F1F9}\u{1F1FC}', IL: '\u{1F1EE}\u{1F1F1}',
  JP: '\u{1F1EF}\u{1F1F5}',
};

const RESOLUTION_MAP = { '12MP': '4K', '8MP': '4K', '4MP': '2K', '2MP': '1080p', '1MP': '720p' };

const STEP_LABELS = ['Brand', 'Model', 'Connection', 'Setup'];

const CATEGORIES = ['All', 'Enterprise', 'Prosumer', 'Consumer'];

const RESOLUTIONS = ['720p', '1080p', '2K', '4K'];

const STREAM_QUALITIES = [
  { value: 'main', label: 'Main Stream' },
  { value: 'sub', label: 'Sub Stream' },
];

const stepTransition = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
};

const stepTransitionBack = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 40 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRtspUrl(brand, form) {
  if (!brand?.rtspPattern) return '';
  const { ip, port, channel, streamQuality, username, password } = form;
  if (!ip) return '';

  let url = brand.rtspPattern;
  const creds = username ? `${username}:${password ? '****' : ''}@` : '';
  url = url.replace('{username}', username || '')
    .replace('{password}', '****')
    .replace('{ip}', ip || '192.168.1.100')
    .replace('{port}', port || '554')
    .replace('{channel}', channel || '1');

  // Handle stream type markers
  if (streamQuality === 'sub') {
    url = url.replace('/101', '/102')
      .replace('/main/', '/sub/')
      .replace('subtype=0', 'subtype=1')
      .replace('/channel0_0.sdp', '/channel0_1.sdp')
      .replace('/cam/realmonitor', '/cam/realmonitor');
  }

  // If the pattern doesn't include the protocol + creds block, build it
  if (!url.startsWith('rtsp://')) {
    url = `rtsp://${creds}${ip}:${port || 554}${url.startsWith('/') ? '' : '/'}${url}`;
  } else {
    // Replace the creds placeholder if present
    url = url.replace(/rtsp:\/\/[^@]*@/, `rtsp://${creds}`);
    if (!url.includes('@') && creds) {
      url = url.replace('rtsp://', `rtsp://${creds}`);
    }
  }

  return url;
}

function buildRealRtspUrl(brand, form) {
  if (!brand?.rtspPattern) return '';
  const { ip, port, channel, streamQuality, username, password } = form;
  if (!ip) return '';

  let url = brand.rtspPattern;
  url = url.replace('{username}', username || '')
    .replace('{password}', password || '')
    .replace('{ip}', ip || '192.168.1.100')
    .replace('{port}', port || '554')
    .replace('{channel}', channel || '1');

  if (streamQuality === 'sub') {
    url = url.replace('/101', '/102')
      .replace('/main/', '/sub/')
      .replace('subtype=0', 'subtype=1')
      .replace('/channel0_0.sdp', '/channel0_1.sdp');
  }

  const creds = username ? `${username}:${password || ''}@` : '';
  if (!url.startsWith('rtsp://')) {
    url = `rtsp://${creds}${ip}:${port || 554}${url.startsWith('/') ? '' : '/'}${url}`;
  } else {
    url = url.replace(/rtsp:\/\/[^@]*@/, `rtsp://${creds}`);
    if (!url.includes('@') && creds) {
      url = url.replace('rtsp://', `rtsp://${creds}`);
    }
  }

  return url;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionLabel = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      color: '#6C63FF',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      mb: 1.5,
      display: 'block',
    }}
  >
    {children}
  </Typography>
);

const ModeCard = ({ icon: Icon, title, subtitle, onClick }) => (
  <GlassCard
    noBorder
    sx={{
      cursor: 'pointer',
      textAlign: 'center',
      py: 4,
      px: 3,
      border: '1px solid rgba(108,99,255,0.08)',
      '&:hover': {
        border: '1px solid rgba(108,99,255,0.3)',
        background: 'rgba(108,99,255,0.06)',
      },
      transition: 'all 0.2s ease',
    }}
    onClick={onClick}
  >
    <Icon sx={{ fontSize: 48, color: '#6C63FF', mb: 2 }} />
    <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography>
    <Typography variant="body2" sx={{ color: '#8892A8' }}>{subtitle}</Typography>
  </GlassCard>
);

const BrandCard = ({ brand, onClick }) => {
  const flag = COUNTRY_FLAGS[brand.country] || '';
  const categoryColor = brand.category === 'Enterprise'
    ? '#6C63FF'
    : brand.category === 'Prosumer'
      ? '#00D9A6'
      : '#FFB547';

  return (
    <GlassCard
      noBorder
      sx={{
        cursor: brand.rtspSupported !== false ? 'pointer' : 'not-allowed',
        p: 2,
        textAlign: 'center',
        position: 'relative',
        border: '1px solid rgba(108,99,255,0.08)',
        opacity: brand.rtspSupported === false ? 0.5 : 1,
        '&:hover': brand.rtspSupported !== false ? {
          border: '1px solid rgba(108,99,255,0.3)',
          background: 'rgba(108,99,255,0.06)',
        } : {},
        transition: 'all 0.2s ease',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={brand.rtspSupported !== false ? onClick : undefined}
    >
      {brand.rtspSupported === false && (
        <Chip
          label="No RTSP"
          size="small"
          icon={<BlockIcon sx={{ fontSize: '14px !important' }} />}
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            height: 20,
            fontSize: '0.6rem',
            bgcolor: 'rgba(255,92,108,0.15)',
            color: '#FF5C6C',
            '& .MuiChip-icon': { color: '#FF5C6C' },
          }}
        />
      )}
      <Typography sx={{ fontSize: '1.5rem', mb: 0.5, lineHeight: 1 }}>{flag}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', mb: 0.5, color: '#E8ECF4' }}>
        {brand.name}
      </Typography>
      <Chip
        label={brand.category}
        size="small"
        sx={{
          height: 18,
          fontSize: '0.6rem',
          fontWeight: 700,
          bgcolor: `${categoryColor}18`,
          color: categoryColor,
        }}
      />
    </GlassCard>
  );
};

const ModelCard = ({ model, selected, onSelect }) => {
  const isSelected = selected === model.id || selected === model.series;
  return (
    <Box
      onClick={() => onSelect(model)}
      sx={{
        p: 2,
        borderRadius: 2,
        cursor: 'pointer',
        border: isSelected
          ? '2px solid #6C63FF'
          : '1px solid rgba(108,99,255,0.08)',
        background: isSelected
          ? 'rgba(108,99,255,0.08)'
          : 'rgba(19, 24, 41, 0.4)',
        transition: 'all 0.2s ease',
        '&:hover': {
          border: isSelected
            ? '2px solid #6C63FF'
            : '1px solid rgba(108,99,255,0.25)',
          background: 'rgba(108,99,255,0.04)',
        },
        mb: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Radio
          checked={isSelected}
          size="small"
          sx={{ p: 0, color: '#555E73', '&.Mui-checked': { color: '#6C63FF' } }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {model.series || model.name}
          </Typography>
          {model.name && model.series && model.name !== model.series && (
            <Typography variant="caption" sx={{ color: '#8892A8' }}>
              {model.name}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.8 }}>
            {model.types?.map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  bgcolor: 'rgba(0,217,166,0.1)',
                  color: '#00D9A6',
                }}
              />
            ))}
            {model.resolution && (
              <Chip
                label={model.resolution}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  bgcolor: 'rgba(108,99,255,0.1)',
                  color: '#8B83FF',
                }}
              />
            )}
          </Box>
          {model.features?.length > 0 && (
            <Typography
              variant="caption"
              sx={{ color: '#555E73', display: 'block', mt: 0.5, fontSize: '0.7rem' }}
            >
              {model.features.join(' \u2022 ')}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const CameraBrandWizard = ({ open, onClose, onSave, editCamera, brands = [] }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [mode, setMode] = useState(null); // 'brand' | 'manual'

  // Brand / model selection
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Connection form
  const [connForm, setConnForm] = useState({
    ip: '',
    port: '554',
    channel: '1',
    streamQuality: 'main',
    username: '',
    password: '',
  });

  // Manual form (for manual mode)
  const [manualForm, setManualForm] = useState({
    name: '',
    rtspUrl: '',
    username: '',
    password: '',
    zone: '',
    floor: '',
    description: '',
  });

  // Location & hardware form (Step 4)
  const [setupForm, setSetupForm] = useState({
    name: '',
    zone: '',
    floor: '',
    description: '',
    resolution: '1080p',
    frameRate: 15,
    hasPTZ: false,
    hasThermal: false,
  });

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Reset state when dialog opens/closes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;

    if (editCamera) {
      // Edit mode: jump to connection step
      setMode('brand');
      setActiveStep(3);
      setDirection(1);

      // Try to find the brand from props
      const cameraBrand = editCamera.brand
        ? brands.find((b) => b.id === editCamera.brand.id || b.name === editCamera.brand.name)
        : null;
      setSelectedBrand(cameraBrand || null);
      setSelectedModel(null);

      // Parse existing RTSP URL for connection details
      let ip = '', port = '554', username = '', password = '';
      if (editCamera.rtspUrl) {
        try {
          const urlStr = editCamera.rtspUrl;
          const match = urlStr.match(/rtsp:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)(?::(\d+))?/);
          if (match) {
            username = match[1] || '';
            password = match[2] || '';
            ip = match[3] || '';
            port = match[4] || '554';
          }
        } catch {
          // Ignore parse errors
        }
      }

      setConnForm({
        ip: ip || '',
        port: port || '554',
        channel: '1',
        streamQuality: 'main',
        username: editCamera.username || username || '',
        password: password || '',
      });

      setSetupForm({
        name: editCamera.name || '',
        zone: editCamera.location?.zone || '',
        floor: editCamera.location?.floor?.toString() || '',
        description: editCamera.location?.description || '',
        resolution: editCamera.resolution || '1080p',
        frameRate: editCamera.frameRate || 15,
        hasPTZ: editCamera.hasPTZ || false,
        hasThermal: editCamera.hasThermal || false,
      });
    } else {
      // Fresh state
      setMode(null);
      setActiveStep(0);
      setDirection(1);
      setSelectedBrand(null);
      setSelectedModel(null);
      setBrandSearch('');
      setCategoryFilter('All');
      setConnForm({ ip: '', port: '554', channel: '1', streamQuality: 'main', username: '', password: '' });
      setManualForm({ name: '', rtspUrl: '', username: '', password: '', zone: '', floor: '', description: '' });
      setSetupForm({ name: '', zone: '', floor: '', description: '', resolution: '1080p', frameRate: 15, hasPTZ: false, hasThermal: false });
    }
    setCopied(false);
    setSaving(false);
  }, [open, editCamera, brands]);

  // -------------------------------------------------------------------------
  // Auto-suggest camera name when zone is filled
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (mode === 'brand' && selectedBrand && setupForm.zone && !setupForm.name) {
      // Only auto-suggest if user hasn't typed a name yet
      setSetupForm((prev) => ({
        ...prev,
        name: `${selectedBrand.name} - ${prev.zone}`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupForm.zone]);

  // -------------------------------------------------------------------------
  // Filtered & sorted brands
  // -------------------------------------------------------------------------
  const filteredBrands = useMemo(() => {
    let list = [...brands];

    // Category filter
    if (categoryFilter !== 'All') {
      list = list.filter((b) => b.category === categoryFilter);
    }

    // Search
    if (brandSearch.trim()) {
      const q = brandSearch.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.country?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q)
      );
    }

    // Sort: popular first, then alphabetical
    list.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [brands, brandSearch, categoryFilter]);

  // -------------------------------------------------------------------------
  // Generated RTSP URL
  // -------------------------------------------------------------------------
  const generatedUrl = useMemo(
    () => buildRtspUrl(selectedBrand, connForm),
    [selectedBrand, connForm]
  );

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const goNext = useCallback(() => {
    setDirection(1);
    setActiveStep((s) => Math.min(s + 1, 4));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setActiveStep((s) => {
      if (s === 1) {
        // Going back from brand selection → mode selection
        setMode(null);
        return 0;
      }
      return Math.max(s - 1, 0);
    });
  }, []);

  // -------------------------------------------------------------------------
  // Brand selection
  // -------------------------------------------------------------------------
  const handleBrandSelect = useCallback(
    (brand) => {
      setSelectedBrand(brand);
      setSelectedModel(null);

      // Auto-fill defaults from brand
      setConnForm((prev) => ({
        ...prev,
        port: brand.defaultPort?.toString() || '554',
        username: brand.defaultUsername || prev.username,
      }));

      setDirection(1);
      setActiveStep(2);
    },
    []
  );

  // -------------------------------------------------------------------------
  // Model selection
  // -------------------------------------------------------------------------
  const handleModelSelect = useCallback(
    (model) => {
      setSelectedModel(model);

      // Auto-fill hardware from model
      const res = model.resolution ? (RESOLUTION_MAP[model.resolution] || model.resolution) : null;
      setSetupForm((prev) => ({
        ...prev,
        resolution: res || prev.resolution,
        frameRate: model.fps || prev.frameRate,
        hasPTZ: model.hasPTZ ?? (model.types?.some((t) => t.toLowerCase() === 'ptz') || prev.hasPTZ),
        hasThermal: model.hasThermal ?? prev.hasThermal,
      }));

      setDirection(1);
      setActiveStep(3);
    },
    []
  );

  const handleSkipModel = useCallback(() => {
    setSelectedModel(null);
    setDirection(1);
    setActiveStep(3);
  }, []);

  // -------------------------------------------------------------------------
  // Copy URL
  // -------------------------------------------------------------------------
  const handleCopyUrl = useCallback(() => {
    const real = buildRealRtspUrl(selectedBrand, connForm);
    if (real) {
      navigator.clipboard?.writeText(real).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [selectedBrand, connForm]);

  // -------------------------------------------------------------------------
  // Save (manual mode)
  // -------------------------------------------------------------------------
  const handleManualSave = useCallback(() => {
    if (!manualForm.name.trim() || !manualForm.rtspUrl.trim()) return;
    setSaving(true);
    const payload = {
      name: manualForm.name.trim(),
      rtspUrl: manualForm.rtspUrl.trim(),
      username: manualForm.username || undefined,
      password: manualForm.password || undefined,
      location: {
        zone: manualForm.zone || undefined,
        floor: manualForm.floor ? Number(manualForm.floor) : undefined,
        description: manualForm.description || undefined,
      },
      resolution: '1080p',
      frameRate: 15,
      hasPTZ: false,
      hasThermal: false,
    };
    onSave(payload);
    setSaving(false);
  }, [manualForm, onSave]);

  // -------------------------------------------------------------------------
  // Save (wizard mode)
  // -------------------------------------------------------------------------
  const handleWizardSave = useCallback(() => {
    if (!setupForm.name.trim()) return;
    setSaving(true);

    const realUrl = buildRealRtspUrl(selectedBrand, connForm);
    const payload = {
      name: setupForm.name.trim(),
      rtspUrl: realUrl,
      username: connForm.username || undefined,
      password: connForm.password || undefined,
      location: {
        zone: setupForm.zone || undefined,
        floor: setupForm.floor ? Number(setupForm.floor) : undefined,
        description: setupForm.description || undefined,
      },
      resolution: setupForm.resolution,
      frameRate: Number(setupForm.frameRate) || 15,
      hasPTZ: setupForm.hasPTZ,
      hasThermal: setupForm.hasThermal,
      brand: selectedBrand
        ? {
            id: selectedBrand.id,
            name: selectedBrand.name,
            ...(selectedModel
              ? {
                  modelSeries: selectedModel.series || selectedModel.id,
                  modelName: selectedModel.name,
                }
              : {}),
          }
        : undefined,
    };
    onSave(payload);
    setSaving(false);
  }, [setupForm, connForm, selectedBrand, selectedModel, onSave]);

  // -------------------------------------------------------------------------
  // Validation helpers
  // -------------------------------------------------------------------------
  const isConnectionValid = connForm.ip.trim().length > 0;
  const isSetupValid = setupForm.name.trim().length > 0;
  const isManualValid = manualForm.name.trim().length > 0 && manualForm.rtspUrl.trim().length > 0;

  // -------------------------------------------------------------------------
  // Animation variants
  // -------------------------------------------------------------------------
  const motionProps = direction >= 0 ? stepTransition : stepTransitionBack;

  // -------------------------------------------------------------------------
  // Render: Step 0 — Choose Mode
  // -------------------------------------------------------------------------
  const renderChooseMode = () => (
    <motion.div key="step-mode" {...motionProps}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          {editCamera ? 'Edit Camera' : 'Add New Camera'}
        </Typography>
        <Typography variant="body2" sx={{ color: '#8892A8' }}>
          Choose how you want to set up your camera
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <ModeCard
            icon={VideocamIcon}
            title="Select Camera Brand"
            subtitle="Choose your brand for auto-configuration"
            onClick={() => {
              setMode('brand');
              setDirection(1);
              setActiveStep(1);
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <ModeCard
            icon={SettingsIcon}
            title="Manual Entry"
            subtitle="Enter RTSP URL directly"
            onClick={() => setMode('manual')}
          />
        </Grid>
      </Grid>

      {/* Manual Entry Form */}
      <AnimatePresence>
        {mode === 'manual' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Box sx={{ mt: 3 }}>
              <SectionLabel>Camera Details</SectionLabel>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Camera Name"
                    placeholder="e.g., Main Entrance"
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="RTSP URL"
                    placeholder="rtsp://192.168.1.100:554/stream1"
                    value={manualForm.rtspUrl}
                    onChange={(e) => setManualForm({ ...manualForm, rtspUrl: e.target.value })}
                    required
                    helperText="The RTSP stream address of your CCTV camera"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    placeholder="admin"
                    value={manualForm.username}
                    onChange={(e) => setManualForm({ ...manualForm, username: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={manualForm.password}
                    onChange={(e) => setManualForm({ ...manualForm, password: e.target.value })}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <SectionLabel>Location</SectionLabel>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Zone / Area"
                      placeholder="e.g., Main Entrance"
                      value={manualForm.zone}
                      onChange={(e) => setManualForm({ ...manualForm, zone: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Floor"
                      type="number"
                      placeholder="1"
                      value={manualForm.floor}
                      onChange={(e) => setManualForm({ ...manualForm, floor: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      placeholder="Camera facing the main door"
                      value={manualForm.description}
                      onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={() => setMode(null)}>Cancel</Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  disabled={!isManualValid || saving}
                  onClick={handleManualSave}
                  sx={{
                    background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
                    '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
                  }}
                >
                  Save Camera
                </Button>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  // -------------------------------------------------------------------------
  // Render: Step 1 — Select Brand
  // -------------------------------------------------------------------------
  const renderSelectBrand = () => (
    <motion.div key="step-brand" {...motionProps}>
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search brands..."
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#555E73', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              size="small"
              onClick={() => setCategoryFilter(cat)}
              sx={{
                fontWeight: 700,
                bgcolor: categoryFilter === cat ? 'rgba(108,99,255,0.2)' : 'rgba(108,99,255,0.06)',
                color: categoryFilter === cat ? '#8B83FF' : '#8892A8',
                border: categoryFilter === cat ? '1px solid rgba(108,99,255,0.3)' : '1px solid transparent',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(108,99,255,0.12)' },
              }}
            />
          ))}
        </Box>
      </Box>

      {filteredBrands.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body2" sx={{ color: '#555E73' }}>
            No brands found matching your search.
          </Typography>
        </Box>
      ) : (
        <Grid
          container
          spacing={1.5}
          sx={{
            maxHeight: 380,
            overflowY: 'auto',
            pr: 0.5,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(108,99,255,0.2)',
              borderRadius: 3,
            },
          }}
        >
          {filteredBrands.map((brand) => (
            <Grid item xs={6} sm={4} md={3} key={brand.id || brand.name}>
              <BrandCard brand={brand} onClick={() => handleBrandSelect(brand)} />
            </Grid>
          ))}
        </Grid>
      )}
    </motion.div>
  );

  // -------------------------------------------------------------------------
  // Render: Step 2 — Select Model
  // -------------------------------------------------------------------------
  const renderSelectModel = () => {
    const models = selectedBrand?.modelSeries || selectedBrand?.models || [];

    return (
      <motion.div key="step-model" {...motionProps}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#8892A8', mb: 0.5 }}>
            Selected Brand
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography sx={{ fontSize: '1.2rem' }}>
              {COUNTRY_FLAGS[selectedBrand?.country] || ''}
            </Typography>
            <Typography variant="h6">{selectedBrand?.name}</Typography>
          </Box>
        </Box>

        {models.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" sx={{ color: '#555E73', mb: 2 }}>
              No model data available for this brand.
            </Typography>
            <Button
              variant="outlined"
              onClick={handleSkipModel}
              sx={{ borderColor: 'rgba(108,99,255,0.3)', color: '#8B83FF' }}
            >
              Continue Without Model
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              maxHeight: 380,
              overflowY: 'auto',
              pr: 0.5,
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(108,99,255,0.2)',
                borderRadius: 3,
              },
            }}
          >
            {models.map((model, idx) => (
              <ModelCard
                key={model.id || model.series || idx}
                model={model}
                selected={selectedModel?.id || selectedModel?.series}
                onSelect={handleModelSelect}
              />
            ))}
          </Box>
        )}

        {models.length > 0 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              size="small"
              startIcon={<HelpOutlineIcon />}
              onClick={handleSkipModel}
              sx={{ color: '#8892A8', '&:hover': { color: '#E8ECF4' } }}
            >
              I don't know my model
            </Button>
          </Box>
        )}
      </motion.div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Step 3 — Connection Details
  // -------------------------------------------------------------------------
  const renderConnection = () => (
    <motion.div key="step-connection" {...motionProps}>
      {/* Brand header in edit mode */}
      {editCamera && selectedBrand && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '1.2rem' }}>
            {COUNTRY_FLAGS[selectedBrand?.country] || ''}
          </Typography>
          <Typography variant="h6" sx={{ color: '#8892A8' }}>
            {selectedBrand.name}
          </Typography>
        </Box>
      )}

      <SectionLabel>Connection</SectionLabel>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="IP Address"
            placeholder="192.168.1.100"
            value={connForm.ip}
            onChange={(e) => setConnForm({ ...connForm, ip: e.target.value })}
            required
            error={activeStep === 3 && connForm.ip.trim() === ''}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Port"
            type="number"
            value={connForm.port}
            onChange={(e) => setConnForm({ ...connForm, port: e.target.value })}
            inputProps={{ min: 1, max: 65535 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Channel"
            type="number"
            value={connForm.channel}
            onChange={(e) => setConnForm({ ...connForm, channel: e.target.value })}
            inputProps={{ min: 1, max: 64 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Stream Quality</InputLabel>
            <Select
              value={connForm.streamQuality}
              label="Stream Quality"
              onChange={(e) => setConnForm({ ...connForm, streamQuality: e.target.value })}
            >
              {STREAM_QUALITIES.map((sq) => (
                <MenuItem key={sq.value} value={sq.value}>
                  {sq.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Username"
            placeholder={selectedBrand?.defaultUsername || 'admin'}
            value={connForm.username}
            onChange={(e) => setConnForm({ ...connForm, username: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={connForm.password}
            onChange={(e) => setConnForm({ ...connForm, password: e.target.value })}
            placeholder={editCamera ? '(unchanged)' : ''}
            helperText={selectedBrand?.passwordNote || undefined}
          />
        </Grid>
      </Grid>

      {/* Generated URL */}
      {selectedBrand?.rtspPattern && (
        <Box sx={{ mt: 3 }}>
          <SectionLabel>Generated RTSP URL</SectionLabel>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: 'rgba(11, 15, 26, 0.6)',
              border: '1px solid rgba(108,99,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.78rem',
                color: '#00D9A6',
                flex: 1,
                wordBreak: 'break-all',
                userSelect: 'all',
              }}
            >
              {generatedUrl || 'Enter an IP address to generate the URL'}
            </Typography>
            {generatedUrl && (
              <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                <IconButton
                  size="small"
                  onClick={handleCopyUrl}
                  sx={{ color: copied ? '#00D9A6' : '#555E73' }}
                >
                  {copied ? (
                    <CheckCircleIcon fontSize="small" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}
    </motion.div>
  );

  // -------------------------------------------------------------------------
  // Render: Step 4 — Location & Name (Setup)
  // -------------------------------------------------------------------------
  const renderSetup = () => (
    <motion.div key="step-setup" {...motionProps}>
      <SectionLabel>Camera Identity</SectionLabel>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Camera Name"
            placeholder="e.g., Main Entrance Cam"
            value={setupForm.name}
            onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })}
            required
            error={setupForm.name.trim() === ''}
            helperText={
              selectedBrand && setupForm.zone && !setupForm.name
                ? `Suggested: ${selectedBrand.name} - ${setupForm.zone}`
                : undefined
            }
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Zone / Area"
            placeholder="e.g., Entrance"
            value={setupForm.zone}
            onChange={(e) => {
              const zone = e.target.value;
              setSetupForm((prev) => ({
                ...prev,
                zone,
                // Auto-suggest name if it's empty or matches old auto-suggestion
                ...((!prev.name || prev.name === `${selectedBrand?.name} - ${prev.zone}`) && selectedBrand && zone
                  ? { name: `${selectedBrand.name} - ${zone}` }
                  : {}),
              }));
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Floor"
            type="number"
            placeholder="1"
            value={setupForm.floor}
            onChange={(e) => setSetupForm({ ...setupForm, floor: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            placeholder="Camera facing the main door"
            value={setupForm.description}
            onChange={(e) => setSetupForm({ ...setupForm, description: e.target.value })}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <SectionLabel>Hardware</SectionLabel>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Resolution</InputLabel>
              <Select
                value={setupForm.resolution}
                label="Resolution"
                onChange={(e) => setSetupForm({ ...setupForm, resolution: e.target.value })}
              >
                {RESOLUTIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}{r === '1080p' ? ' (Full HD)' : r === '4K' ? ' (Ultra HD)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Frame Rate (fps)"
              type="number"
              value={setupForm.frameRate}
              onChange={(e) => setSetupForm({ ...setupForm, frameRate: e.target.value })}
              inputProps={{ min: 1, max: 60 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={setupForm.hasPTZ}
                  onChange={(e) => setSetupForm({ ...setupForm, hasPTZ: e.target.checked })}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#6C63FF' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#6C63FF',
                    },
                  }}
                />
              }
              label="Pan-Tilt-Zoom (PTZ)"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={setupForm.hasThermal}
                  onChange={(e) => setSetupForm({ ...setupForm, hasThermal: e.target.checked })}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#6C63FF' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#6C63FF',
                    },
                  }}
                />
              }
              label="Thermal Sensor"
            />
          </Grid>
        </Grid>
      </Box>
    </motion.div>
  );

  // -------------------------------------------------------------------------
  // Which step content to render
  // -------------------------------------------------------------------------
  const renderStepContent = () => {
    if (activeStep === 0) return renderChooseMode();
    if (mode === 'brand') {
      switch (activeStep) {
        case 1: return renderSelectBrand();
        case 2: return renderSelectModel();
        case 3: return renderConnection();
        case 4: return renderSetup();
        default: return null;
      }
    }
    return null;
  };

  // -------------------------------------------------------------------------
  // Should we show the stepper?
  // -------------------------------------------------------------------------
  const showStepper = mode === 'brand' && activeStep >= 1;

  // -------------------------------------------------------------------------
  // Can the user proceed?
  // -------------------------------------------------------------------------
  const canNext = () => {
    if (activeStep === 3) return isConnectionValid;
    return true;
  };

  // -------------------------------------------------------------------------
  // Navigation buttons
  // -------------------------------------------------------------------------
  const renderNav = () => {
    // No nav for step 0 or manual mode
    if (activeStep === 0 || mode === 'manual') return null;

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 3,
          pt: 2,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={goBack}
          sx={{ color: '#8892A8', '&:hover': { color: '#E8ECF4' } }}
        >
          Back
        </Button>

        {activeStep === 4 ? (
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            disabled={!isSetupValid || saving}
            onClick={handleWizardSave}
            sx={{
              background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
              '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
            }}
          >
            Save Camera
          </Button>
        ) : activeStep === 3 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            disabled={!canNext()}
            onClick={goNext}
            sx={{
              background: 'linear-gradient(135deg, #6C63FF, #4A42CC)',
              '&:hover': { background: 'linear-gradient(135deg, #8B83FF, #6C63FF)' },
            }}
          >
            Next
          </Button>
        ) : null}

        {/* Steps 1 and 2 don't have a Next button — clicking a brand/model advances automatically */}
      </Box>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <AnimatedDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Dialog header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            {editCamera ? 'Edit Camera' : 'Add Camera'}
          </Typography>
          <Button
            size="small"
            onClick={onClose}
            sx={{ minWidth: 'auto', color: '#555E73', '&:hover': { color: '#E8ECF4' } }}
          >
            Close
          </Button>
        </Box>

        {/* Stepper */}
        {showStepper && (
          <Stepper
            activeStep={activeStep - 1}
            alternativeLabel={!isMobile}
            sx={{
              mb: 3,
              '& .MuiStepLabel-label': {
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#555E73',
                '&.Mui-active': { color: '#6C63FF' },
                '&.Mui-completed': { color: '#00D9A6' },
              },
              '& .MuiStepIcon-root': {
                color: '#555E73',
                '&.Mui-active': { color: '#6C63FF' },
                '&.Mui-completed': { color: '#00D9A6' },
              },
              '& .MuiStepConnector-line': {
                borderColor: 'rgba(108,99,255,0.15)',
              },
            }}
          >
            {STEP_LABELS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {/* Step Content */}
        <Box sx={{ minHeight: isMobile ? 'auto' : 400 }}>
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </Box>

        {/* Navigation */}
        {renderNav()}
      </Box>
    </AnimatedDialog>
  );
};

export default CameraBrandWizard;
