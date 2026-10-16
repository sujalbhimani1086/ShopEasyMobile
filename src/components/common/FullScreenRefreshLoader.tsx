import React from 'react';
import {
  FullPageContentLoader,
  FullPageContentLoaderProps,
} from './FullPageContentLoader';

export type FullScreenRefreshLoaderProps = FullPageContentLoaderProps;

/**
 * FullScreenRefreshLoader
 *
 * Alias for FullPageContentLoader for seamless backward compatibility.
 */
export const FullScreenRefreshLoader: React.FC<FullScreenRefreshLoaderProps> = (
  props
) => {
  return (
    <FullPageContentLoader
      {...props}
      testID={props.testID || 'full-screen-refresh-loader'}
    />
  );
};

export { FullPageContentLoader };

