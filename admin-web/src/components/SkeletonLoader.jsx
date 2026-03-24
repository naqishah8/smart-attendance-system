import React from 'react';
import { Skeleton, Box, Grid, Card, CardContent } from '@mui/material';

export const DashboardSkeleton = () => (
  <Box>
    <Skeleton variant="text" width={200} height={40} sx={{ mb: 1 }} />
    <Skeleton variant="text" width={300} height={20} sx={{ mb: 3 }} />
    <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }} sx={{ mb: 4 }}>
      {[0,1,2,3].map(i => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Card><CardContent sx={{ p: 3 }}>
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={40} sx={{ mt: 1 }} />
          </CardContent></Card>
        </Grid>
      ))}
    </Grid>
    <TableSkeleton rows={5} cols={4} />
  </Box>
);

export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <Card>
    <Box sx={{ p: 2 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <Box key={r} sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} variant="text" sx={{ flex: 1 }} height={22} />
          ))}
        </Box>
      ))}
    </Box>
  </Card>
);

export const CardGridSkeleton = ({ count = 6 }) => (
  <Grid container spacing={{ xs: 1.5, sm: 2, lg: 3 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Grid item xs={12} sm={6} lg={4} key={i}>
        <Card><CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width="70%" height={24} />
          <Skeleton variant="rectangular" height={120} sx={{ mt: 1.5, borderRadius: 1 }} />
          <Skeleton variant="text" width="50%" height={16} sx={{ mt: 1 }} />
        </CardContent></Card>
      </Grid>
    ))}
  </Grid>
);
