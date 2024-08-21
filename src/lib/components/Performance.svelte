<script lang="ts">
  import {
    moqVideoEncodeLatencyStore,
    moqVideoTransmissionLatencyStore,
    moqVideoDecodeLatencyStore
  } from '$lib/moq/utils/store';
</script>

<div class="performance">
  <h2>Performance Metrics</h2>
  <div class="latency">
    <h3>Latency</h3>
    <p>Encode: {Math.floor($moqVideoEncodeLatencyStore)}ms</p>
    <p>Transmission: {Math.floor($moqVideoTransmissionLatencyStore)}ms</p>
    <p>Decode: {Math.floor($moqVideoDecodeLatencyStore)}ms</p>
  </div>
</div>
