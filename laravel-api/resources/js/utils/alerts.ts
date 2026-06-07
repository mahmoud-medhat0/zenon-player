import Swal from 'sweetalert2';

const MySwal = Swal.mixin({
  background: '#121214',
  color: '#f8fafc',
  customClass: {
    popup: 'glass-panel',
    confirmButton: 'btn-primary',
    cancelButton: 'btn-cancel'
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
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#ef4444',
    customClass: {
      popup: 'glass-panel',
      confirmButton: 'btn-primary',
      cancelButton: 'btn-cancel'
    }
  });

  return result.isConfirmed;
};
