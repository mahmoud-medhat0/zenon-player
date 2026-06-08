import Swal from 'sweetalert2';
import i18n from '../i18n';

const MySwal = Swal.mixin({
  background: '#1a1a1f', // Match the modal background (rgba(255,255,255,0.03) or slightly dark)
  color: '#f8fafc',
  customClass: {
    popup: 'glass-panel',
    confirmButton: 'swal-btn-primary',
    cancelButton: 'swal-btn-cancel'
  },
  buttonsStyling: false
});

export const showSuccess = (title: string, text?: string) => {
  return MySwal.fire({
    icon: 'success',
    title,
    text,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  });
};

export const showError = (title: string, text?: string) => {
  return MySwal.fire({
    icon: 'error',
    title,
    text,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
  });
};

export const confirmDelete = async (title: string, text: string): Promise<boolean> => {
  const result = await MySwal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: i18n.t('common.delete', { defaultValue: 'Yes, delete it' }),
    cancelButtonText: i18n.t('common.cancel', { defaultValue: 'Cancel' }),
    customClass: {
      popup: 'glass-panel',
      confirmButton: 'swal-btn-danger',
      cancelButton: 'swal-btn-cancel'
    }
  });

  return result.isConfirmed;
};
