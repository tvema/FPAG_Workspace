import { useMemo } from 'react';
import { WaveformViewer, WaveformViewerViewState } from './WaveformViewer';
import { parseVCD } from '../utils/vcdParser';
import { ErrorBoundary } from './ErrorBoundary';

export function VCDWrapper({ content, viewState, onViewStateChange, filesData }: { content: string, viewState?: WaveformViewerViewState, onViewStateChange?: (state: WaveformViewerViewState) => void, filesData?: any }) {
  const vcdData = useMemo(() => {
    try {
      return parseVCD(content);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [content]);

  if (!vcdData) {
    return <div className="p-4 text-rose-400">Error parsing VCD file. The file may be corrupted or unsupported.</div>;
  }
  return (
    <ErrorBoundary>
      <WaveformViewer vcd={vcdData} viewState={viewState} onViewStateChange={onViewStateChange} filesData={filesData} />
    </ErrorBoundary>
  );
}
